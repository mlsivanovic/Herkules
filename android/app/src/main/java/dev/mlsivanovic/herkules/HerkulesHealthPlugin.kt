package dev.mlsivanovic.herkules

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import androidx.activity.result.ActivityResult
import androidx.core.content.ContextCompat
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedDeque
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@CapacitorPlugin(
    name = "HerkulesHealth",
    permissions = [
        Permission(
            strings = [
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
            ],
            alias = "bluetooth",
        ),
        Permission(
            strings = [Manifest.permission.POST_NOTIFICATIONS],
            alias = "notifications",
        ),
        // Android 9-11 return no BLE scan results without location.
        Permission(
            strings = [Manifest.permission.ACCESS_FINE_LOCATION],
            alias = "location",
        ),
    ],
)
class HerkulesHealthPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val main = Handler(Looper.getMainLooper())
    private val samples = ConcurrentLinkedDeque<JSObject>()
    private val lock = Any()
    private var gatt: BluetoothGatt? = null
    private var deviceAddress: String? = null
    private var deviceName: String? = null
    /** idle, connecting, connected, lost (sensor dropped, reconnecting) or failed. */
    @Volatile private var hrState = "idle"
    private var everConnected = false
    private var scanCallback: ScanCallback? = null

    private val healthPermissions = setOf(
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
    )

    override fun handleOnDestroy() {
        stopGatt(clearSamples = true)
        scope.cancel()
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val status = when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
            else -> "unavailable"
        }
        val result = JSObject()
        result.put("status", status)
        call.resolve(result)
    }

    @PluginMethod
    fun requestHealthPermissions(call: PluginCall) {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect is not available")
            return
        }
        val intent = PermissionController.createRequestPermissionResultContract()
            .createIntent(context, healthPermissions)
        startActivityForResult(call, intent, "onHealthPermissions")
    }

    @ActivityCallback
    private fun onHealthPermissions(call: PluginCall, result: ActivityResult) {
        val granted = PermissionController.createRequestPermissionResultContract()
            .parseResult(result.resultCode, result.data)
        val payload = JSObject()
        payload.put("granted", granted.containsAll(healthPermissions))
        call.resolve(payload)
    }

    @PluginMethod
    fun readWorkouts(call: PluginCall) {
        val start = call.getLong("startMs") ?: return call.reject("startMs required")
        val end = call.getLong("endMs") ?: return call.reject("endMs required")
        scope.launch {
            try {
                val workouts = queryWorkouts(start, end)
                val payload = JSObject()
                payload.put("workouts", workouts)
                call.resolve(payload)
            } catch (error: Exception) {
                call.reject(error.message ?: "Could not read workouts")
            }
        }
    }

    @PluginMethod
    fun readHeartRate(call: PluginCall) {
        val start = call.getLong("startMs") ?: return call.reject("startMs required")
        val end = call.getLong("endMs") ?: return call.reject("endMs required")
        scope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val series = readHeartRate(client, Instant.ofEpochMilli(start), Instant.ofEpochMilli(end))
                val payload = JSObject()
                payload.put("samples", series)
                call.resolve(payload)
            } catch (error: Exception) {
                call.reject(error.message ?: "Could not read heart rate")
            }
        }
    }

    @PluginMethod
    fun scanHeartRate(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 31 && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "onBluetoothGranted")
            return
        }
        if (Build.VERSION.SDK_INT < 31 && getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "onLocationGranted")
            return
        }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "onNotificationsGranted")
            return
        }
        startScan(call)
    }

    @PermissionCallback
    private fun onBluetoothGranted(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 31 && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Bluetooth permission was not granted")
            return
        }
        scanHeartRate(call)
    }

    @PermissionCallback
    private fun onLocationGranted(call: PluginCall) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission is needed to find Bluetooth sensors")
            return
        }
        scanHeartRate(call)
    }

    @PermissionCallback
    private fun onNotificationsGranted(call: PluginCall) {
        startScan(call)
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    fun connectHeartRate(call: PluginCall) {
        val deviceId = call.getString("deviceId") ?: return call.reject("deviceId required")
        val title = call.getString("notificationTitle") ?: "Herkules"
        if (Build.VERSION.SDK_INT >= 31 && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            return call.reject("Bluetooth permission was not granted")
        }
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        val adapter = manager.adapter
        if (adapter == null || !adapter.isEnabled) return call.reject("Bluetooth is off")
        val device = try {
            adapter.getRemoteDevice(deviceId)
        } catch (error: IllegalArgumentException) {
            return call.reject("Unknown Bluetooth device")
        }
        stopGatt(clearSamples = false)
        val intent = Intent(context, HeartRateService::class.java).putExtra(HeartRateService.EXTRA_TITLE, title)
        try {
            ContextCompat.startForegroundService(context, intent)
        } catch (error: Exception) {
            return call.reject(error.message ?: "Could not keep the sensor connected in the background")
        }
        synchronized(lock) {
            deviceAddress = deviceId
            deviceName = call.getString("deviceName")
            everConnected = false
            hrState = "connecting"
            gatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
        }
        call.resolve(statePayload())
    }

    @PluginMethod
    fun heartRateState(call: PluginCall) {
        call.resolve(statePayload())
    }

    @PluginMethod
    fun drainHeartRate(call: PluginCall) {
        val drained = JSArray()
        while (true) {
            val sample = samples.pollFirst() ?: break
            drained.put(sample)
        }
        val payload = statePayload()
        payload.put("samples", drained)
        call.resolve(payload)
    }

    @PluginMethod
    fun stopHeartRate(call: PluginCall) {
        stopGatt(clearSamples = true)
        call.resolve(statePayload())
    }

    private fun statePayload(): JSObject {
        val payload = JSObject()
        payload.put("state", hrState)
        deviceAddress?.let { payload.put("deviceId", it) }
        deviceName?.let { payload.put("deviceName", it) }
        return payload
    }

    @SuppressLint("MissingPermission")
    private fun startScan(call: PluginCall) {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        val scanner = manager.adapter?.bluetoothLeScanner
        if (scanner == null) {
            call.reject("Bluetooth is off")
            return
        }
        scanCallback?.let {
            try {
                scanner.stopScan(it)
            } catch (_: Exception) {
            }
        }
        val found = linkedMapOf<String, String>()
        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val device = result.device ?: return
                val name = result.scanRecord?.deviceName ?: device.name ?: device.address
                found[device.address] = name
            }
        }
        scanCallback = callback
        val filters = listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(HR_SERVICE)).build())
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        try {
            scanner.startScan(filters, settings, callback)
        } catch (error: SecurityException) {
            call.reject(error.message ?: "Bluetooth scan was denied")
            return
        }
        main.postDelayed({
            try {
                scanner.stopScan(callback)
            } catch (_: Exception) {
            }
            if (scanCallback === callback) scanCallback = null
            val devices = JSArray()
            for ((id, name) in found) {
                val item = JSObject()
                item.put("id", id)
                item.put("name", name)
                devices.put(item)
            }
            val payload = JSObject()
            payload.put("devices", devices)
            call.resolve(payload)
        }, SCAN_MS)
    }

    /** User stop, Finish or plugin teardown. Never called for a sensor drop. */
    @SuppressLint("MissingPermission")
    private fun stopGatt(clearSamples: Boolean) {
        synchronized(lock) {
            val current = gatt
            gatt = null
            deviceAddress = null
            deviceName = null
            everConnected = false
            hrState = "idle"
            try {
                current?.disconnect()
                current?.close()
            } catch (_: Exception) {
            }
        }
        main.removeCallbacks(reconnect)
        if (clearSamples) samples.clear()
        context.stopService(Intent(context, HeartRateService::class.java))
    }

    /** Waits for the sensor to come back in range; autoConnect has no timeout. */
    @SuppressLint("MissingPermission")
    private val reconnect: Runnable = Runnable {
        synchronized(lock) {
            val address = deviceAddress ?: return@Runnable
            if (gatt != null) return@Runnable
            val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
            val device = try {
                manager.adapter?.getRemoteDevice(address)
            } catch (_: Exception) {
                null
            } ?: return@Runnable
            try {
                gatt = device.connectGatt(context, true, gattCallback, BluetoothDevice.TRANSPORT_LE)
            } catch (_: SecurityException) {
                hrState = "failed"
            }
        }
    }

    @SuppressLint("MissingPermission")
    private val gattCallback: BluetoothGattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            synchronized(lock) {
                // A callback from a connection that was already replaced or stopped.
                if (gatt !== this@HerkulesHealthPlugin.gatt) {
                    if (newState == BluetoothProfile.STATE_DISCONNECTED) gatt.close()
                    return
                }
                if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                    gatt.discoverServices()
                    return
                }
                if (newState != BluetoothProfile.STATE_DISCONNECTED &&
                    status == BluetoothGatt.GATT_SUCCESS
                ) {
                    return
                }
                // Dropped, out of range, or the first attempt failed.
                try {
                    gatt.close()
                } catch (_: Exception) {
                }
                this@HerkulesHealthPlugin.gatt = null
                if (deviceAddress == null) return
                hrState = if (everConnected) "lost" else "failed"
                if (everConnected) {
                    main.removeCallbacks(reconnect)
                    main.postDelayed(reconnect, RECONNECT_MS)
                } else {
                    deviceAddress = null
                    deviceName = null
                    main.post { context.stopService(Intent(context, HeartRateService::class.java)) }
                }
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            val characteristic = gatt.getService(HR_SERVICE)?.getCharacteristic(HR_MEASUREMENT)
            val descriptor = characteristic?.getDescriptor(CLIENT_CONFIG)
            if (status != BluetoothGatt.GATT_SUCCESS || characteristic == null || descriptor == null) {
                failConnection(gatt)
                return
            }
            gatt.setCharacteristicNotification(characteristic, true)
            if (Build.VERSION.SDK_INT >= 33) {
                gatt.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
            } else {
                @Suppress("DEPRECATION")
                descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                @Suppress("DEPRECATION")
                gatt.writeDescriptor(descriptor)
            }
        }

        override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
            if (descriptor.uuid != CLIENT_CONFIG) return
            if (status != BluetoothGatt.GATT_SUCCESS) {
                failConnection(gatt)
                return
            }
            synchronized(lock) {
                if (gatt !== this@HerkulesHealthPlugin.gatt) return
                everConnected = true
                hrState = "connected"
            }
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray,
        ) {
            pushSample(value)
        }

        @Deprecated("Deprecated in API 33")
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            @Suppress("DEPRECATION")
            val value = characteristic.value ?: return
            pushSample(value)
        }
    }

    /** The device connected but does not offer heart-rate notifications. */
    @SuppressLint("MissingPermission")
    private fun failConnection(gatt: BluetoothGatt) {
        synchronized(lock) {
            if (gatt !== this.gatt) return
            if (everConnected) {
                // Reconnected but discovery failed: drop and try again later.
                gatt.disconnect()
                return
            }
        }
        stopGatt(clearSamples = false)
        hrState = "failed"
    }

    private fun pushSample(value: ByteArray) {
        val bpm = parseBpm(value) ?: return
        if (samples.size >= MAX_SAMPLES) samples.pollFirst()
        val sample = JSObject()
        sample.put("at", System.currentTimeMillis())
        sample.put("bpm", bpm)
        samples.addLast(sample)
    }

    private suspend fun queryWorkouts(startMs: Long, endMs: Long): JSArray {
        val client = HealthConnectClient.getOrCreate(context)
        val range = TimeRangeFilter.between(Instant.ofEpochMilli(startMs), Instant.ofEpochMilli(endMs))
        val sessions = readAll(client, ExerciseSessionRecord::class, range)
        val workouts = JSArray()
        for (session in sessions) {
            val heartRate = readHeartRate(client, session.startTime, session.endTime)
            val totals = readTotals(client, session.startTime, session.endTime, session.metadata.dataOrigin)
            val distance = totals.first
            val calories = totals.second
            val item = JSObject()
            item.put("id", session.metadata.id)
            item.put("origin", session.metadata.dataOrigin.packageName)
            item.put("exerciseType", session.exerciseType)
            item.put("startMs", session.startTime.toEpochMilli())
            item.put("endMs", session.endTime.toEpochMilli())
            if (distance == null) item.put("distanceM", org.json.JSONObject.NULL) else item.put("distanceM", distance)
            if (calories == null) item.put("caloriesKcal", org.json.JSONObject.NULL) else item.put("caloriesKcal", calories)
            item.put("heartRate", heartRate)
            workouts.put(item)
        }
        return workouts
    }

    private suspend fun readHeartRate(client: HealthConnectClient, start: Instant, end: Instant): JSArray {
        val records = readAll(client, HeartRateRecord::class, TimeRangeFilter.between(start, end))
        val samples = mutableListOf<Pair<Long, Int>>()
        for (record in records) {
            for (sample in record.samples) {
                val bpm = sample.beatsPerMinute
                if (bpm <= 0 || bpm > 250) continue
                samples.add(sample.time.toEpochMilli() to bpm.toInt())
            }
        }
        samples.sortBy { it.first }
        val step = if (samples.size <= MAX_SAMPLES) 1 else kotlin.math.ceil(samples.size / MAX_SAMPLES.toDouble()).toInt()
        val array = JSArray()
        samples.forEachIndexed { index, sample ->
            if (index % step != 0) return@forEachIndexed
            val item = JSObject()
            item.put("at", sample.first)
            item.put("bpm", sample.second)
            array.put(item)
        }
        return array
    }

    /**
     * Distance and energy written by the app that recorded the session. Aggregation
     * prorates records that only partly overlap the session, and the origin filter
     * keeps phone pedometer and second-watch copies out of the total.
     */
    private suspend fun readTotals(
        client: HealthConnectClient,
        start: Instant,
        end: Instant,
        origin: DataOrigin,
    ): Pair<Double?, Double?> {
        val response = client.aggregate(
            AggregateRequest(
                metrics = setOf(DistanceRecord.DISTANCE_TOTAL, TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(start, end),
                dataOriginFilter = setOf(origin),
            ),
        )
        val distance = response[DistanceRecord.DISTANCE_TOTAL]?.inMeters
        val calories = response[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
        return distance to calories
    }

    private suspend fun <T : Record> readAll(
        client: HealthConnectClient,
        type: kotlin.reflect.KClass<T>,
        range: TimeRangeFilter,
    ): List<T> {
        val all = mutableListOf<T>()
        var pageToken: String? = null
        do {
            val response = client.readRecords(
                ReadRecordsRequest(recordType = type, timeRangeFilter = range, pageToken = pageToken),
            )
            all.addAll(response.records)
            pageToken = response.pageToken
        } while (pageToken != null)
        return all
    }

    companion object {
        private val HR_SERVICE: UUID = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
        private val HR_MEASUREMENT: UUID = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
        private val CLIENT_CONFIG: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        private const val SCAN_MS = 8_000L
        private const val MAX_SAMPLES = 8_000
        private const val RECONNECT_MS = 1_000L
    }
}

private fun parseBpm(value: ByteArray): Int? {
    if (value.size < 2) return null
    val flags = value[0].toInt() and 0xff
    if (flags and 0x06 == 0x04) return null
    val wide = flags and 0x01 != 0
    if (wide && value.size < 3) return null
    val bpm = if (wide) {
        (value[1].toInt() and 0xff) or ((value[2].toInt() and 0xff) shl 8)
    } else {
        value[1].toInt() and 0xff
    }
    return bpm.takeIf { it in 1..250 }
}

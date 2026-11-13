package dev.mlsivanovic.herkules;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The in-app theme saved on the last run, so the first frame already matches it.
        String preference = HerkulesThemePlugin.savedPreference(this);
        registerPlugin(HerkulesHealthPlugin.class);
        registerPlugin(HerkulesThemePlugin.class);
        super.onCreate(savedInstanceState);
        // Only after super.onCreate: Capacitor switches from the splash theme to
        // AppTheme.NoActionBar there. Touching the window earlier builds the decor view
        // with the splash theme's title bar and splash background, which then stays
        // as a band under the status bar.
        enableEdgeToEdge(preference);
        HerkulesThemePlugin.applyWindowBackground(this, preference);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }

    /**
     * Target SDK 36 draws edge-to-edge. Transparent scrims keep Android from laying a
     * gray contrast bar over the status and gesture areas; the style picks the icon color
     * (dark: light icons, light: dark icons, auto: follow the system night mode).
     */
    private void enableEdgeToEdge(String preference) {
        SystemBarStyle style;
        if ("dark".equals(preference)) {
            style = SystemBarStyle.dark(Color.TRANSPARENT);
        } else if ("light".equals(preference)) {
            style = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT);
        } else {
            style = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT);
        }
        EdgeToEdge.enable(this, style, style);
    }
}

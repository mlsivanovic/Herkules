package dev.mlsivanovic.herkules;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Remembers the in-app Light / Dark / System choice natively, so the next launch
 * paints the window and system bar icons in that theme before the web view loads.
 */
@CapacitorPlugin(name = "HerkulesTheme")
public class HerkulesThemePlugin extends Plugin {
    private static final String PREFS = "herkules_theme";
    private static final String KEY = "preference";

    // Keep in sync with --c-bg in src/styles/theme.css and res/values*/colors.xml.
    static final int LIGHT_BG = Color.parseColor("#f6f7fb");
    static final int DARK_BG = Color.parseColor("#0d0f15");

    /** "light", "dark" or "system". */
    static String savedPreference(Context context) {
        String value = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "system");
        return "light".equals(value) || "dark".equals(value) ? value : "system";
    }

    /** Explicit choices override the window background; System uses the values-night resource. */
    static void applyWindowBackground(Activity activity, String preference) {
        if ("light".equals(preference)) {
            activity.getWindow().setBackgroundDrawable(new ColorDrawable(LIGHT_BG));
        } else if ("dark".equals(preference)) {
            activity.getWindow().setBackgroundDrawable(new ColorDrawable(DARK_BG));
        } else {
            activity.getWindow().setBackgroundDrawableResource(R.color.windowBackground);
        }
    }

    @PluginMethod
    public void setPreference(PluginCall call) {
        String preference = call.getString("preference", "system");
        if (!"light".equals(preference) && !"dark".equals(preference)) preference = "system";
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY, preference).apply();

        final String applied = preference;
        Activity activity = getActivity();
        if (activity != null) activity.runOnUiThread(() -> applyWindowBackground(activity, applied));
        JSObject result = new JSObject();
        result.put("preference", applied);
        call.resolve(result);
    }
}

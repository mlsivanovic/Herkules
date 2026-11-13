package dev.mlsivanovic.herkules;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HerkulesHealthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

package com.db.producteditorserver.util;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MockData {
    public static Map<String, Object> getTemplateJson() {
        Map<String, Object> response = new HashMap<>();

        // Main canvas template (800x800)
        Map<String, Object> mainTemplate = new HashMap<>();
        mainTemplate.put("width", 800);
        mainTemplate.put("height", 800);
        mainTemplate.put("layers", List.of(
            // Background Image
            Map.of("type", "image", "src", "/images/hero_v2.png", "left", 0, "top", 0, "width", 800, "height", 800),
            // Product Slot (Central)
            Map.of("type", "image-slot", "id", "slot_product", "left", 50, "top", 50, "width", 700, "height", 600),
            // Bottom Text bar
            Map.of("type", "rect", "fill", "black", "opacity", 0.6, "width", 800, "height", 120, "top", 680, "left", 0),
            Map.of("type", "text", "id", "text_title", "text", "等待AI生成标题...", "fill", "white", "top", 710, "left", 400, "originX", "center", "fontSize", 44, "fontWeight", "bold")
        ));

        // Share card template (500x400 - 5:4)
        Map<String, Object> shareTemplate = new HashMap<>();
        shareTemplate.put("width", 500);
        shareTemplate.put("height", 400);
        shareTemplate.put("layers", List.of(
            // Background Image
            Map.of("type", "image", "src", "/images/pairing_v2.png", "left", 0, "top", 0, "width", 500, "height", 400),
            // Semi-transparent side panel for info
            Map.of("type", "rect", "fill", "#ffffff", "opacity", 0.85, "width", 200, "height", 400, "left", 300, "top", 0),
            // Product Slot
            Map.of("type", "image-slot", "id", "slot_product", "left", 310, "top", 20, "width", 180, "height", 240),
            // Text
            Map.of("type", "text", "id", "text_title", "text", "AI生成标题", "fill", "#1a1a1a", "top", 280, "left", 400, "originX", "center", "fontSize", 22, "fontWeight", "bold", "width", 180)
        ));

        response.put("main", mainTemplate);
        response.put("share", shareTemplate);
        return response;
    }
}

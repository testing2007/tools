package com.db.producteditorserver.controller;

import com.db.producteditorserver.service.AiService;
import com.db.producteditorserver.util.MockData;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // Allows cross-origin requests for MVP
public class MvpController {

    @Autowired
    private AiService aiService;

    // 1. Upload image endpoint
    @PostMapping("/upload")
    public Map<String, String> uploadFile(@RequestParam("file") MultipartFile file) throws IOException {
        String filename = System.currentTimeMillis() + "_" + file.getOriginalFilename();
        File uploadDir = new File("./uploads/");
        if (!uploadDir.exists()) {
            uploadDir.mkdirs();
        }
        
        File saveFile = new File(uploadDir, filename);
        file.transferTo(saveFile);

        // Return the static path for the uploaded image
        return Map.of("url", "/images/" + filename);
    }

    // 2. AI generation endpoint
    @PostMapping("/generate")
    public String generateCopy(@RequestBody Map<String, String> payload) {
        String keyword = payload.get("keyword");
        return aiService.call(keyword);
    }

    // 3. Template data endpoint
    @GetMapping("/template")
    public Map<String, Object> getTemplate() {
        return MockData.getTemplateJson();
    }
}

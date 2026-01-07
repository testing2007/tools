package com.db.producteditorserver.service;

import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

@Service
public class AiService {
    // Note: In a real app, use an environment variable for the API key
    private static final String API_KEY = "sk-076a624bf5ff4609aff9a9397f574e95"; 
    private static final String API_URL = "https://api.deepseek.com/chat/completions";

    private final HttpClient httpClient = HttpClient.newHttpClient();

    public String call(String keyword) {
        // Simplified mock implementation if API key is not provided
        if ("YOUR_DEEPSEEK_API_KEY".equals(API_KEY)) {
            return String.format("{\"shortTitle\": \"%s 优质推荐\", \"productTitle\": \"%s - 您的不二之选\", \"shareText\": \"快来看看这款超级好用的 %s！性价比极高，正品保证。\"}", keyword, keyword, keyword);
        }

        try {
            String prompt = String.format("请根据关键词'%s'生成电商文案。要求返回纯 JSON 格式，包含字段：shortTitle (短标题), productTitle (产品标题), shareText (推荐语)。", keyword);
            
            // DeepSeek OpenAI-compatible payload
            String requestBody = String.format(
                "{\"model\": \"deepseek-chat\", \"messages\": [{\"role\": \"user\", \"content\": \"%s\"}], \"stream\": false}",
                prompt
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_URL))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + API_KEY)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String body = response.body();
            
            // Extract content safely from the assistant message
            // DeepSeek returns a JSON with choices[0].message.content
            // We'll use a simple extraction for MVP
            int contentIndex = body.indexOf("\"content\":\"");
            if (contentIndex != -1) {
                int start = contentIndex + 11;
                // Find end of content (handling escaped quotes is tricky without a proper JSON parser, 
                // but for MVP we'll look for the closing structure of the message)
                int end = body.indexOf("\"},\"logprobs\""); 
                if (end == -1) end = body.lastIndexOf("\"}");
                
                String content = body.substring(start, end)
                        .replace("\\n", "\n")
                        .replace("\\\"", "\"");
                
                // Remove markdown code blocks
                if (content.contains("```json")) {
                    content = content.substring(content.indexOf("```json") + 7);
                    if (content.contains("```")) {
                        content = content.substring(0, content.lastIndexOf("```"));
                    }
                } else if (content.contains("```")) {
                    content = content.substring(content.indexOf("```") + 3);
                    if (content.contains("```")) {
                        content = content.substring(0, content.lastIndexOf("```"));
                    }
                }
                return content.trim();
            }
            
            return body;
        } catch (Exception e) {
            e.printStackTrace();
            return "{\"shortTitle\": \"错误\", \"productTitle\": \"生成失败\", \"shareText\": \"无法连接到 DeepSeek\"}";
        }
    }
}

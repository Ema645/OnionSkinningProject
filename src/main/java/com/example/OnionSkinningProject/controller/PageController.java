package com.example.OnionSkinningProject.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    @GetMapping("/")
    public String showPage() {
        return "index";
    }

    @GetMapping("/homepage")
    public String showHomepage() {
        return "homepage";
    }

    @GetMapping("/videopage")
    public String showVideopage() {
        return "videopage";
    }

    @GetMapping("/frames")
    public String showFrames() {
        return "frames";
    }
}

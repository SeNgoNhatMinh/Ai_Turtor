package com.ragapi.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.util.TimeZone;

@Configuration
public class TimeZoneConfig {

    @Value("${app.timezone:Asia/Bangkok}")
    private String timezone;

    @PostConstruct
    void configureDefaultTimeZone() {
        TimeZone.setDefault(TimeZone.getTimeZone(timezone));
    }
}

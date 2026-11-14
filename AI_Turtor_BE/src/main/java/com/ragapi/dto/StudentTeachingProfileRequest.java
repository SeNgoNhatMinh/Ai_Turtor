package com.ragapi.dto;

import lombok.Data;

import java.util.List;

@Data
public class StudentTeachingProfileRequest {
    private List<String> learnsBestWith;
    private List<String> struggleSignals;
    private String pace;
    private String teacherNote;
}

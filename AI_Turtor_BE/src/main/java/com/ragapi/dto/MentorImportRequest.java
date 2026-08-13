package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * MentorImportRequest - Request �'�f trigger import
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MentorImportRequest {
    private Boolean dryRun; // true = preview errors, false = thực hi�?n import (default: false)
}







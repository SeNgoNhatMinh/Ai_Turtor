package com.ragapi.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "Admin request to promote or demote a teacher account")
public class AdminTeacherRoleUpdateRequest {

    @Schema(description = "Allowed values: TEACHER or SENIOR_MENTOR", example = "SENIOR_MENTOR")
    private String role;
}

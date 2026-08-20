package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import org.springframework.stereotype.Service;

@Service
public class CourseMaterialAccessPolicy {

    public void requireManagePermission(CourseMaterial material, String requesterId, String requesterRole) {
        if (isPrivileged(requesterRole)) {
            return;
        }
        if (!isTeacher(requesterRole)
                || isBlank(requesterId)
                || !requesterId.equals(material.getTeacherId())
                || !"TEACHER".equalsIgnoreCase(material.getUploadedByRole())
                || !"CLASS_SECTION".equalsIgnoreCase(material.getMaterialScope())) {
            throw new SecurityException("Teachers can only update or delete materials they uploaded themselves");
        }
    }

    public void requireReindexPermission(String requesterRole) {
        if (!isPrivileged(requesterRole)) {
            throw new SecurityException("Only senior mentors or administrators can reindex course materials");
        }
    }

    public boolean isPrivileged(String requesterRole) {
        return "ADMIN".equalsIgnoreCase(requesterRole)
                || "SENIOR_MENTOR".equalsIgnoreCase(requesterRole);
    }

    public boolean isTeacher(String requesterRole) {
        return "TEACHER".equalsIgnoreCase(requesterRole)
                || "MENTOR".equalsIgnoreCase(requesterRole);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}

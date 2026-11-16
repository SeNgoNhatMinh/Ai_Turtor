package com.ragapi.service.behavior;

/** The authenticated user acting on the teaching-behavior library. */
public record BehaviorActor(String id, String name, String role) {
    public boolean isAdmin() {
        return role != null && "ADMIN".equalsIgnoreCase(role.trim());
    }
}

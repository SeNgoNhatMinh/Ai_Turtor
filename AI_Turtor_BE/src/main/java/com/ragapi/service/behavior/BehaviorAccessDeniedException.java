package com.ragapi.service.behavior;

public class BehaviorAccessDeniedException extends RuntimeException {
    public BehaviorAccessDeniedException(String message) {
        super(message);
    }
}

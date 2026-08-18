package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ValidationUtilsTest {

    @Test
    void acceptsCodeAtConfiguredLineLimit() {
        String code = String.join("\n", java.util.Collections.nCopies(
                ValidationUtils.CODE_SNIPPET_MAX_LINES,
                "int value = 1;"
        ));

        assertEquals(code, ValidationUtils.optionalCodeSnippet(code, "code"));
    }

    @Test
    void rejectsCodeAboveConfiguredLineLimit() {
        String code = String.join("\n", java.util.Collections.nCopies(
                ValidationUtils.CODE_SNIPPET_MAX_LINES + 1,
                "int value = 1;"
        ));

        assertThrows(
                IllegalArgumentException.class,
                () -> ValidationUtils.optionalCodeSnippet(code, "code")
        );
    }

    @Test
    void rejectsCodeAboveConfiguredCharacterLimit() {
        String code = "a".repeat(ValidationUtils.CODE_SNIPPET_MAX_LENGTH + 1);

        assertThrows(
                IllegalArgumentException.class,
                () -> ValidationUtils.optionalCodeSnippet(code, "code")
        );
    }
}

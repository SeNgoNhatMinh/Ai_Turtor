package com.ragapi.harness;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HarnessCollectionsTest {

    @Test
    void renamesAManagementCollectionWhenTheHarnessNameIsAbsent() {
        assertTrue(HarnessCollections.shouldRename(true, false, 0));
    }

    @Test
    void replacesAnEmptyHarnessCollectionCreatedBeforeTheRename() {
        assertTrue(HarnessCollections.shouldRename(true, true, 0));
    }

    @Test
    void leavesBothCollectionsWhenTheHarnessNameAlreadyHasDocuments() {
        assertFalse(HarnessCollections.shouldRename(true, true, 3));
    }

    @Test
    void doesNothingWhenTheOldCollectionIsAlreadyGone() {
        assertFalse(HarnessCollections.shouldRename(false, true, 4));
        assertEquals(28, HarnessCollections.RENAMES_FROM_MANAGEMENT_NAMES.size());
    }
}

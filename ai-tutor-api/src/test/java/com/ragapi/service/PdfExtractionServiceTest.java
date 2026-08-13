package com.ragapi.service;

import com.ragapi.entity.MaterialTocEntry;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PdfExtractionServiceTest {

    @Test
    void assignPageEndEntriesUsesNextSiblingSection() {
        List<MaterialTocEntry> entries = new ArrayList<>();
        entries.add(MaterialTocEntry.builder().title("Chapter 1: Introduction").level(0).pageStart(10).build());
        entries.add(MaterialTocEntry.builder().title("1.1 Turing Model").level(1).pageStart(12).build());
        entries.add(MaterialTocEntry.builder().title("Chapter 2: Number Systems").level(0).pageStart(40).build());

        PdfExtractionService.assignPageEndEntries(entries, 200);

        assertEquals(39, entries.get(0).getPageEnd());
        assertEquals(39, entries.get(1).getPageEnd());
        assertEquals(200, entries.get(2).getPageEnd());
    }
}

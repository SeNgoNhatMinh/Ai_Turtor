package com.ragapi.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> {

    private List<T> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private boolean first;
    private boolean last;

    public static <T> PageResponse<T> from(List<T> source, Integer requestedPage, Integer requestedSize) {
        List<T> safeSource = source == null ? List.of() : source;
        int size = Math.max(1, Math.min(requestedSize == null ? 20 : requestedSize, 100));
        int totalPages = Math.max(1, (int) Math.ceil((double) safeSource.size() / size));
        int page = Math.max(0, Math.min(requestedPage == null ? 0 : requestedPage, totalPages - 1));
        int fromIndex = Math.min(page * size, safeSource.size());
        int toIndex = Math.min(fromIndex + size, safeSource.size());

        return PageResponse.<T>builder()
                .content(safeSource.subList(fromIndex, toIndex))
                .page(page)
                .size(size)
                .totalElements(safeSource.size())
                .totalPages(totalPages)
                .first(page == 0)
                .last(page >= totalPages - 1)
                .build();
    }

    public static <T> PageResponse<T> unpaged(List<T> source) {
        List<T> safeSource = source == null ? List.of() : source;
        return PageResponse.<T>builder()
                .content(safeSource)
                .page(0)
                .size(safeSource.size())
                .totalElements(safeSource.size())
                .totalPages(1)
                .first(true)
                .last(true)
                .build();
    }
}

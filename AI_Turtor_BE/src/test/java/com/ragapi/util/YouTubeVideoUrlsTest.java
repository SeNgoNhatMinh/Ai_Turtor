package com.ragapi.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class YouTubeVideoUrlsTest {

    @Test
    void extractsWatchShareAndEmbedIds() {
        assertThat(YouTubeVideoUrls.videoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
                .isEqualTo("dQw4w9WgXcQ");
        assertThat(YouTubeVideoUrls.videoId("https://youtu.be/dQw4w9WgXcQ"))
                .isEqualTo("dQw4w9WgXcQ");
        assertThat(YouTubeVideoUrls.videoId("https://www.youtube.com/embed/dQw4w9WgXcQ"))
                .isEqualTo("dQw4w9WgXcQ");
        assertThat(YouTubeVideoUrls.embedUrl("dQw4w9WgXcQ"))
                .isEqualTo("https://www.youtube.com/embed/dQw4w9WgXcQ");
    }

    @Test
    void rejectsNonYoutubeLinks() {
        assertThat(YouTubeVideoUrls.videoId("https://vimeo.com/123")).isNull();
        assertThatThrownBy(() -> YouTubeVideoUrls.requireVideoId("not-a-url"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}

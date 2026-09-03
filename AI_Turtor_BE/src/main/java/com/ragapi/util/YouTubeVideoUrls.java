package com.ragapi.util;

import java.net.URI;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Accepts common YouTube watch/share/embed URLs and returns the 11-character video id.
 */
public final class YouTubeVideoUrls {

    private static final Pattern VIDEO_ID = Pattern.compile("^[A-Za-z0-9_-]{11}$");
    private static final Pattern PATH_ID = Pattern.compile(
            "(?:embed|shorts|live|v)/([A-Za-z0-9_-]{11})"
    );

    private YouTubeVideoUrls() {
    }

    public static String requireVideoId(String rawUrl) {
        String videoId = videoId(rawUrl);
        if (videoId == null) {
            throw new IllegalArgumentException("youtubeUrl must be a valid YouTube watch, share, or embed link");
        }
        return videoId;
    }

    public static String videoId(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return null;
        }
        String trimmed = rawUrl.trim();
        if (VIDEO_ID.matcher(trimmed).matches()) {
            return trimmed;
        }
        URI uri;
        try {
            uri = URI.create(trimmed);
        } catch (IllegalArgumentException exception) {
            return null;
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (!host.endsWith("youtube.com") && !host.equals("youtu.be") && !host.endsWith("youtube-nocookie.com")) {
            return null;
        }
        if (host.equals("youtu.be")) {
            String path = uri.getPath() == null ? "" : uri.getPath().replace("/", "");
            return VIDEO_ID.matcher(path).matches() ? path : null;
        }
        String query = uri.getQuery();
        if (query != null) {
            for (String pair : query.split("&")) {
                int eq = pair.indexOf('=');
                if (eq > 0 && "v".equals(pair.substring(0, eq)) && VIDEO_ID.matcher(pair.substring(eq + 1)).matches()) {
                    return pair.substring(eq + 1);
                }
            }
        }
        String path = uri.getPath() == null ? "" : uri.getPath();
        Matcher matcher = PATH_ID.matcher(path);
        return matcher.find() ? matcher.group(1) : null;
    }

    public static String embedUrl(String videoId) {
        return "https://www.youtube.com/embed/" + videoId;
    }
}

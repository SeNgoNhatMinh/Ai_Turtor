package com.ragapi.util;

import java.util.List;

public final class EmbeddingSimilarityUtil {

    private EmbeddingSimilarityUtil() {
    }

    public static double cosineSimilarity(List<Float> left, List<Float> right) {
        if (left == null || right == null || left.isEmpty() || right.isEmpty() || left.size() != right.size()) {
            return 0.0;
        }
        double dot = 0.0;
        double leftNorm = 0.0;
        double rightNorm = 0.0;
        for (int index = 0; index < left.size(); index++) {
            double a = left.get(index);
            double b = right.get(index);
            dot += a * b;
            leftNorm += a * a;
            rightNorm += b * b;
        }
        if (leftNorm <= 0.0 || rightNorm <= 0.0) {
            return 0.0;
        }
        return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
    }

    public static List<Float> toFloatList(float[] vector) {
        if (vector == null || vector.length == 0) {
            return List.of();
        }
        Float[] boxed = new Float[vector.length];
        for (int index = 0; index < vector.length; index++) {
            boxed[index] = vector[index];
        }
        return List.of(boxed);
    }
}

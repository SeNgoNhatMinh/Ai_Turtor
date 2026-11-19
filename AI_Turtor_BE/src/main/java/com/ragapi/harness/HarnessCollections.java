package com.ragapi.harness;

import java.util.Map;

/** Runtime collection names. School records such as users and courses stay unchanged. */
public final class HarnessCollections {

    public static final String QUIZ_RUNS = "harness_quiz_runs";
    public static final String HANDOFFS = "harness_handoffs";
    public static final String ANSWER_CACHE = "harness_answer_cache";
    public static final String CURRICULA = "harness_curricula";
    public static final String DIRECTIVES = "harness_directives";
    public static final String BEHAVIORS = "harness_behaviors";
    public static final String BEHAVIOR_VERSIONS = "harness_behavior_versions";
    public static final String BEHAVIOR_RUNS = "harness_behavior_runs";
    public static final String BEHAVIOR_APPLICATIONS = "harness_behavior_applications";
    public static final String LEARNER_PROFILES = "harness_learner_profiles";
    public static final String ADAPTIVE_REVIEWS = "harness_adaptive_reviews";
    public static final String SUPPORT_LOCKS = "harness_support_locks";
    public static final String LEARNING_EVIDENCE = "harness_learning_evidence";
    public static final String QUIZ_SESSIONS = "harness_quiz_sessions";
    public static final String COURSE_MEMORIES = "harness_course_memories";
    public static final String ANSWER_REVIEWS = "harness_answer_reviews";
    public static final String SESSION_SUMMARIES = "harness_session_summaries";
    public static final String SESSIONS = "harness_sessions";
    public static final String IMPROVE_PLANS = "harness_improve_plans";
    public static final String KNOWLEDGE = "harness_knowledge";
    public static final String MENTOR_ANSWERS = "harness_mentor_answers";
    public static final String GOLD_QA = "harness_gold_qa";
    public static final String EXPERT_TASKS = "harness_expert_tasks";
    public static final String EXPERT_RUBRICS = "harness_expert_rubrics";
    public static final String COVERAGE_GAPS = "harness_coverage_gaps";
    public static final String CACHE_HITS = "harness_cache_hits";
    public static final String LEARNER_MEMORIES = "harness_learner_memories";
    public static final String CHAPTER_OUTLINES = "harness_chapter_outlines";

    public static final Map<String, String> RENAMES_FROM_MANAGEMENT_NAMES = Map.ofEntries(
            Map.entry("quiz_assignments", QUIZ_RUNS),
            Map.entry("question_escalations", HANDOFFS),
            Map.entry("canonical_tutor_answers", ANSWER_CACHE),
            Map.entry("course_learning_guides", CURRICULA),
            Map.entry("pedagogical_directives", DIRECTIVES),
            Map.entry("teaching_behaviors", BEHAVIORS),
            Map.entry("teaching_behavior_versions", BEHAVIOR_VERSIONS),
            Map.entry("teaching_behavior_executions", BEHAVIOR_RUNS),
            Map.entry("applied_teaching_behaviors", BEHAVIOR_APPLICATIONS),
            Map.entry("student_teaching_profiles", LEARNER_PROFILES),
            Map.entry("adaptive_learning_reviews", ADAPTIVE_REVIEWS),
            Map.entry("adaptive_support_level_locks", SUPPORT_LOCKS),
            Map.entry("learning_evidence", LEARNING_EVIDENCE),
            Map.entry("quiz_sessions", QUIZ_SESSIONS),
            Map.entry("student_course_memories", COURSE_MEMORIES),
            Map.entry("ai_answer_reviews", ANSWER_REVIEWS),
            Map.entry("tutor_session_summaries", SESSION_SUMMARIES),
            Map.entry("tutor_sessions", SESSIONS),
            Map.entry("improve_plans", IMPROVE_PLANS),
            Map.entry("knowledge_candidates", KNOWLEDGE),
            Map.entry("mentor_answers", MENTOR_ANSWERS),
            Map.entry("gold_qa", GOLD_QA),
            Map.entry("expert_tasks", EXPERT_TASKS),
            Map.entry("expert_rubrics", EXPERT_RUBRICS),
            Map.entry("coverage_gaps", COVERAGE_GAPS),
            Map.entry("tutor_cache_hit_audits", CACHE_HITS),
            Map.entry("user_memories", LEARNER_MEMORIES),
            Map.entry("course_chapter_outlines", CHAPTER_OUTLINES)
    );

    private HarnessCollections() {
    }

    static boolean shouldRename(boolean oldExists, boolean newExists, long newDocumentCount) {
        if (!oldExists) {
            return false;
        }
        return !newExists || newDocumentCount == 0;
    }
}

# Visual RAG configuration

## Demo provider: OpenRouter

The existing local API keys remain in `application-local.yml`. Visual RAG reuses the existing embedding key and does not duplicate its value.

```yaml
rag:
  visual:
    enabled: true
    provider: openrouter
    elasticsearch-index: course_material_vectors_visual_nemotron_v1
    openrouter:
      api-key: ${rag.embedding.openrouter.api-key}
      model: nvidia/llama-nemotron-embed-vl-1b-v2:free
```

For Docker or deployment, use environment variables instead of literal secrets:

```env
RAG_VISUAL_ENABLED=true
RAG_VISUAL_PROVIDER=openrouter
OPENROUTER_VISUAL_EMBEDDING_API_KEY=your-key
OPENROUTER_VISUAL_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free
RAG_VISUAL_ELASTICSEARCH_INDEX=course_material_vectors_visual_nemotron_v1
```

## Future local PixelRAG provider

Use a different index when switching embedding models. Qwen and Nemotron vectors must never share an index.

```env
RAG_VISUAL_PROVIDER=pixelrag
RAG_VISUAL_ELASTICSEARCH_INDEX=course_material_vectors_visual_qwen_v1
```

Keep the Nemotron index until migration and retrieval verification are complete so rollback remains possible.

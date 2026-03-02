package com.crm.backend.memory;

import com.crm.backend.common.exception.ResourceNotFoundException;
import com.crm.backend.config.CrmProperties;
import com.crm.backend.memory.model.EpisodicMemory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class EpisodicMemoryService {

    private final EpisodicMemoryRepository episodicMemoryRepository;
    private final CrmProperties crmProperties;

    @Transactional
    public EpisodicMemory recordEpisode(UUID entityId,
                                         String entityType,
                                         String eventType,
                                         String summary,
                                         UUID sessionId,
                                         String agentId,
                                         Map<String, Object> metadata) {
        EpisodicMemory episode = EpisodicMemory.builder()
                .entityId(entityId)
                .entityType(entityType)
                .eventType(eventType)
                .summary(summary)
                .sessionId(sessionId)
                .agentId(agentId)
                .metadata(metadata != null ? metadata : Map.of())
                .build();
        episode = episodicMemoryRepository.save(episode);
        log.debug("Recorded episode={} for entity={}", episode.getEpisodeId(), entityId);
        return episode;
    }

    @Transactional
    public EpisodicMemory linkEmbedding(UUID episodeId, String qdrantPointId) {
        EpisodicMemory episode = episodicMemoryRepository.findById(episodeId)
                .orElseThrow(() -> new ResourceNotFoundException("EpisodicMemory", episodeId));
        episode.setEmbeddingRef(qdrantPointId);
        return episodicMemoryRepository.save(episode);
    }

    @Transactional(readOnly = true)
    public List<EpisodicMemory> getRecent(UUID entityId, int limit) {
        return episodicMemoryRepository.findByEntityIdOrderByOccurredAtDesc(
                entityId, PageRequest.of(0, limit));
    }

    @Transactional(readOnly = true)
    public List<EpisodicMemory> getByEntity(UUID entityId,
                                             String entityType,
                                             int limit,
                                             Instant before) {
        int cap = Math.min(limit, 100);
        if (entityType != null && before != null) {
            return episodicMemoryRepository
                    .findByEntityIdAndEntityTypeAndOccurredAtBeforeOrderByOccurredAtDesc(
                            entityId, entityType, before, PageRequest.of(0, cap));
        }
        if (entityType != null) {
            return episodicMemoryRepository
                    .findByEntityIdAndEntityTypeOrderByOccurredAtDesc(
                            entityId, entityType, PageRequest.of(0, cap));
        }
        // entityType not provided — return all episodes for this entity
        return episodicMemoryRepository
                .findByEntityIdOrderByOccurredAtDesc(entityId, PageRequest.of(0, cap));
    }
}

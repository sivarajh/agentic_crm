package com.crm.backend.project;

import com.crm.backend.common.exception.ResourceNotFoundException;
import com.crm.backend.conversation.ConversationRepository;
import com.crm.backend.conversation.model.Conversation;
import com.crm.backend.project.model.Project;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ConversationRepository conversationRepository;

    @Transactional
    public Project createProject(UUID userId, String name) {
        Project project = Project.builder()
                .userId(userId)
                .name(name)
                .build();
        project = projectRepository.save(project);
        log.info("Created project={} for user={}", project.getProjectId(), userId);
        return project;
    }

    @Transactional(readOnly = true)
    public Project getProject(UUID projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
    }

    @Transactional(readOnly = true)
    public List<Project> getProjectsByUser(UUID userId) {
        return projectRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtAsc(userId);
    }

    @Transactional
    public Project renameProject(UUID projectId, String name) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
        project.setName(name);
        return projectRepository.save(project);
    }

    @Transactional
    public void deleteProject(UUID projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
        // Unassign all conversations from this project
        conversationRepository.findByProjectId(projectId)
                .forEach(conv -> {
                    conv.setProjectId(null);
                    conversationRepository.save(conv);
                });
        project.setDeletedAt(Instant.now());
        projectRepository.save(project);
        log.info("Soft-deleted project={}", projectId);
    }

    @Transactional
    public Conversation assignConversationToProject(UUID conversationId, UUID projectId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation", conversationId));
        if (projectId != null && !projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project", projectId);
        }
        conv.setProjectId(projectId);
        return conversationRepository.save(conv);
    }
}

package com.crm.backend.project;

import com.crm.backend.common.model.ApiResponse;
import com.crm.backend.conversation.model.Conversation;
import com.crm.backend.project.model.Project;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @PostMapping
    public ResponseEntity<ApiResponse<Project>> createProject(
            @Valid @RequestBody CreateProjectRequest request) {
        Project project = projectService.createProject(request.getUserId(), request.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(project));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<Project>>> getProjectsByUser(
            @RequestParam UUID userId) {
        return ResponseEntity.ok(ApiResponse.ok(projectService.getProjectsByUser(userId)));
    }

    @GetMapping("/{projectId}")
    public ResponseEntity<ApiResponse<Project>> getProject(
            @PathVariable UUID projectId) {
        return ResponseEntity.ok(ApiResponse.ok(projectService.getProject(projectId)));
    }

    @PutMapping("/{projectId}")
    public ResponseEntity<ApiResponse<Project>> renameProject(
            @PathVariable UUID projectId,
            @Valid @RequestBody RenameProjectRequest request) {
        Project project = projectService.renameProject(projectId, request.getName());
        return ResponseEntity.ok(ApiResponse.ok(project));
    }

    @DeleteMapping("/{projectId}")
    public ResponseEntity<ApiResponse<Void>> deleteProject(
            @PathVariable UUID projectId) {
        projectService.deleteProject(projectId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PatchMapping("/{projectId}/conversations/{conversationId}")
    public ResponseEntity<ApiResponse<Conversation>> assignConversation(
            @PathVariable UUID projectId,
            @PathVariable UUID conversationId) {
        Conversation conv = projectService.assignConversationToProject(conversationId, projectId);
        return ResponseEntity.ok(ApiResponse.ok(conv));
    }

    @DeleteMapping("/{projectId}/conversations/{conversationId}")
    public ResponseEntity<ApiResponse<Conversation>> unassignConversation(
            @PathVariable UUID projectId,
            @PathVariable UUID conversationId) {
        Conversation conv = projectService.assignConversationToProject(conversationId, null);
        return ResponseEntity.ok(ApiResponse.ok(conv));
    }

    // ─── Request DTOs ──────────────────────────────────────────────────────────

    @Data
    public static class CreateProjectRequest {
        @NotNull
        private UUID userId;
        @NotBlank
        private String name;
    }

    @Data
    public static class RenameProjectRequest {
        @NotBlank
        private String name;
    }
}

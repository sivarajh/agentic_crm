package com.crm.backend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed configuration properties for the CRM application.
 * Bound from application.yml under the {@code crm} prefix.
 */
@Data
@ConfigurationProperties(prefix = "crm")
public class CrmProperties {

    private Agents agents = new Agents();
    private Session session = new Session();
    private Context context = new Context();
    private Qdrant qdrant = new Qdrant();
    private Memory memory = new Memory();
    private Compliance compliance = new Compliance();

    @Data
    public static class Agents {
        private String orchestratorUrl = "http://localhost:8001";
        private String memoryAgentUrl = "http://localhost:8002";
        private String contextAgentUrl = "http://localhost:8003";
        private String guardrailsUrl = "http://localhost:8004";
        private long connectionTimeoutMs = 5000;
        private long readTimeoutMs = 30000;
    }

    @Data
    public static class Session {
        private long ttlMinutes = 30;
        private long heartbeatIntervalMs = 60000;
    }

    @Data
    public static class Context {
        private long cacheTtlMinutes = 5;
    }

    @Data
    public static class Qdrant {
        private String host = "localhost";
        private int port = 6334;
        private String apiKey = "";
        private boolean useTls = false;
        private String semanticCollection = "crm_semantic";
        private String episodicCollection = "crm_episodic_embeddings";
    }

    @Data
    public static class Memory {
        private Episodic episodic = new Episodic();
        private Working working = new Working();

        @Data
        public static class Episodic {
            private int recentLimit = 10;
        }

        @Data
        public static class Working {
            private long ttlMinutes = 30;
            private int reasoningMaxEntries = 50;
        }
    }

    @Data
    public static class Compliance {
        private Audit audit = new Audit();

        @Data
        public static class Audit {
            private String hashAlgorithm = "SHA-256";
        }
    }
}

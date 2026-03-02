# Multi-stage build for crm-backend
# Uses the official Maven image (includes Maven + JDK 21) — no apk add needed.
# COPY order: pom.xml first so the dependency-download layer is cached
# and only re-runs when pom.xml changes (not on every source edit).
FROM maven:3.9-eclipse-temurin-21-alpine AS build

WORKDIR /app

# 1. Copy only the POM and resolve all dependencies (cached layer)
COPY pom.xml .
RUN mvn dependency:go-offline

# 2. Copy source and build (this layer re-runs on any src change)
COPY src ./src
RUN mvn package -DskipTests

# ─── Runtime image ─────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

RUN addgroup -S crm && adduser -S crm -G crm
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

USER crm
EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]

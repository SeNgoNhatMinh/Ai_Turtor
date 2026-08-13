package com.ragapi.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String BEARER_AUTH = "bearerAuth";

    @Bean
    public OpenAPI aiTutorOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("AI Tutor Platform API")
                        .description("API for course-scoped AI tutoring, course materials, student memory, and learning support workflows. Use /api/users/login to get a JWT, then click Authorize and paste: Bearer <token>.")
                        .version("1.0.0"))
                .components(new Components().addSecuritySchemes(BEARER_AUTH,
                        new SecurityScheme()
                                .name(BEARER_AUTH)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Paste the JWT returned by /api/users/login or /api/users/register.")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH));
    }
}
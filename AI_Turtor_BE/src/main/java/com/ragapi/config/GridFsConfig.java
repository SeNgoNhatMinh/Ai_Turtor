package com.ragapi.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;

@Configuration
public class GridFsConfig {

    public static final String COURSE_MATERIAL_BUCKET = "course_materials";

    @Bean
    public GridFsTemplate gridFsTemplate(
            MongoDatabaseFactory databaseFactory,
            MongoConverter mongoConverter
    ) {
        return new GridFsTemplate(databaseFactory, mongoConverter, COURSE_MATERIAL_BUCKET);
    }
}






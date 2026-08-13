package com.ragapi.config;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.transport.ElasticsearchTransport;
import co.elastic.clients.transport.rest_client.RestClientTransport;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import org.apache.http.HttpHost;
import org.apache.http.client.config.RequestConfig;
import org.elasticsearch.client.RestClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ElasticConfig {

    @Value("${elasticsearch.host}")
    private String host;

    @Value("${elasticsearch.port}")
    private int port;

    @Value("${elasticsearch.connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${elasticsearch.socket-timeout-ms:5000}")
    private int socketTimeoutMs;

    @Value("${elasticsearch.connection-request-timeout-ms:3000}")
    private int connectionRequestTimeoutMs;

    @Bean
    public ElasticsearchClient elasticsearchClient() {

        RestClient restClient = RestClient.builder(new HttpHost(host, port))
                .setRequestConfigCallback(this::configureTimeouts)
                .build();

        ElasticsearchTransport transport =
                new RestClientTransport(
                        restClient,
                        new JacksonJsonpMapper()
                );

        return new ElasticsearchClient(transport);
    }

    private RequestConfig.Builder configureTimeouts(RequestConfig.Builder builder) {
        return builder
                .setConnectTimeout(connectTimeoutMs)
                .setSocketTimeout(socketTimeoutMs)
                .setConnectionRequestTimeout(connectionRequestTimeoutMs);
    }
}






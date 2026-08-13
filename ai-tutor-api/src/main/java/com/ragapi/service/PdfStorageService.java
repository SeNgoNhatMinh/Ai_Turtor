package com.ragapi.service;

import com.mongodb.client.gridfs.model.GridFSFile;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;

@Slf4j
@Service
@RequiredArgsConstructor
public class PdfStorageService {

    private final GridFsTemplate gridFsTemplate;

    public String store(byte[] pdfBytes, String fileName, String documentId) {
        org.bson.Document metadata = new org.bson.Document()
                .append("documentId", documentId)
                .append("contentType", "application/pdf");

        ObjectId fileId = gridFsTemplate.store(
                new ByteArrayInputStream(pdfBytes),
                fileName,
                "application/pdf",
                metadata
        );

        log.info(
                "Course material PDF saved to MongoDB GridFS bucket 'course_materials': id={}, documentId={}, size={} bytes",
                fileId,
                documentId,
                pdfBytes.length
        );

        return fileId.toHexString();
    }

    public GridFsResource loadByDocumentId(String documentId) throws IOException {
        GridFSFile file = gridFsTemplate.findOne(
                Query.query(Criteria.where("metadata.documentId").is(documentId))
        );

        if (file == null) {
            throw new IllegalArgumentException("Kh\u00f4ng t\u00ecm th\u1ea5y file PDF trong MongoDB cho t\u00e0i li\u1ec7u n\u00e0y");
        }

        return gridFsTemplate.getResource(file);
    }

    public void deleteByDocumentId(String documentId) {
        gridFsTemplate.delete(Query.query(Criteria.where("metadata.documentId").is(documentId)));
    }

    public GridFsResource loadByFileId(String pdfFileId) throws IOException {
        GridFSFile file = gridFsTemplate.findOne(
                Query.query(Criteria.where("_id").is(new ObjectId(pdfFileId)))
        );

        if (file == null) {
            throw new IllegalArgumentException("Kh\u00f4ng t\u00ecm th\u1ea5y file PDF v\u1edbi id: " + pdfFileId);
        }

        return gridFsTemplate.getResource(file);
    }
}
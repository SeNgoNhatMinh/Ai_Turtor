package com.ragapi.repository;

import com.ragapi.entity.Semester;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SemesterRepository extends MongoRepository<Semester, String> {

    Optional<Semester> findBySemesterCode(String semesterCode);
}

package repository_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func TestUserCreate(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewUserRepository(db)

	user, err := repo.Create("admin", "$2a$10$hashedpassword")
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	if user.Username != "admin" {
		t.Errorf("expected username 'admin', got %q", user.Username)
	}
	if user.ID == "" {
		t.Error("expected non-empty ID")
	}
}

func TestUserCreateDuplicateUsername(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewUserRepository(db)

	repo.Create("admin", "hash1")
	_, err := repo.Create("admin", "hash2")
	if err == nil {
		t.Error("expected error for duplicate username")
	}
}

func TestUserGetByUsername(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewUserRepository(db)

	repo.Create("testuser", "$2a$10$somehash")

	user, err := repo.GetByUsername("testuser")
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	if user == nil {
		t.Fatal("expected non-nil user")
	}
	if user.Username != "testuser" {
		t.Errorf("expected 'testuser', got %q", user.Username)
	}
	if user.PasswordHash != "$2a$10$somehash" {
		t.Error("expected password hash to be stored")
	}
}

func TestUserGetByUsernameNotFound(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewUserRepository(db)

	user, err := repo.GetByUsername("nonexistent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if user != nil {
		t.Error("expected nil for nonexistent user")
	}
}

func TestUserGetByID(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewUserRepository(db)

	created, _ := repo.Create("testuser", "hash")
	user, err := repo.GetByID(created.ID)
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	if user == nil {
		t.Fatal("expected non-nil user")
	}
	if user.Username != "testuser" {
		t.Errorf("expected 'testuser', got %q", user.Username)
	}
}

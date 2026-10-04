package dashboard

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kirito99152/ProxyManager/internal/auth"
	"github.com/kirito99152/ProxyManager/internal/models"
)

type UserResponse struct {
	ID         int       `db:"id" json:"id"`
	Username   string    `db:"username" json:"username"`
	Email      *string   `db:"email" json:"email"`
	Role       string    `db:"role" json:"role"`
	IsVerified bool      `db:"is_verified" json:"is_verified"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

func generateOTPCode() string {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "123456"
	}
	return fmt.Sprintf("%06d", n.Int64()+100000)
}

func (h *DashboardHandler) GetUsers(c *gin.Context) {
	users := make([]UserResponse, 0)
	err := h.database.Select(&users, "SELECT id, username, email, role, is_verified, created_at FROM users ORDER BY created_at DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (h *DashboardHandler) GetVerifiedMembers(c *gin.Context) {
	users := make([]UserResponse, 0)
	err := h.database.Select(&users, "SELECT id, username, email, role, is_verified, created_at FROM users WHERE is_verified = 1 AND email IS NOT NULL AND email != '' ORDER BY username ASC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch verified members"})
		return
	}
	c.JSON(http.StatusOK, users)
}

type CreateUserRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email"`
	Password string `json:"password" binding:"required"`
	Role     string `json:"role" binding:"required,oneof=admin user"`
}

func (h *DashboardHandler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	req.Email = strings.TrimSpace(req.Email)
	var emailVal *string
	var codeVal *string
	var expiresVal *time.Time
	var isVerified bool

	if req.Email != "" {
		emailVal = &req.Email
		otp := generateOTPCode()
		codeVal = &otp
		exp := time.Now().Add(15 * time.Minute)
		expiresVal = &exp
		isVerified = false
	}

	res, err := h.database.Exec(
		"INSERT INTO users (username, email, password_hash, role, is_verified, verification_code, verification_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		req.Username, emailVal, hash, req.Role, isVerified, codeVal, expiresVal,
	)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") || strings.Contains(err.Error(), "Duplicate") {
			c.JSON(http.StatusConflict, gin.H{"error": "Tên đăng nhập hoặc Email đã tồn tại"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		}
		return
	}

	if req.Email != "" && codeVal != nil && h.alertManager != nil {
		_ = h.alertManager.SendVerificationOTP(req.Email, req.Username, *codeVal)
	}

	userID, _ := res.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{
		"message": "User created successfully",
		"id":      userID,
	})
}

type UpdateUserRequest struct {
	Email    *string `json:"email"`
	Password string  `json:"password"`
	Role     string  `json:"role" binding:"omitempty,oneof=admin user"`
}

func (h *DashboardHandler) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var current models.User
	err := h.database.Get(&current, "SELECT * FROM users WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if req.Password != "" {
		hash, err := auth.HashPassword(req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		_, err = h.database.Exec("UPDATE users SET password_hash = ? WHERE id = ?", hash, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
			return
		}
	}

	if req.Role != "" {
		_, err := h.database.Exec("UPDATE users SET role = ? WHERE id = ?", req.Role, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
			return
		}
	}

	if req.Email != nil {
		newEmail := strings.TrimSpace(*req.Email)
		currentEmail := ""
		if current.Email != nil {
			currentEmail = *current.Email
		}

		if newEmail != currentEmail {
			if newEmail == "" {
				_, err = h.database.Exec("UPDATE users SET email = NULL, is_verified = 0, verification_code = NULL, verification_expires_at = NULL WHERE id = ?", id)
			} else {
				otp := generateOTPCode()
				exp := time.Now().Add(15 * time.Minute)
				_, err = h.database.Exec("UPDATE users SET email = ?, is_verified = 0, verification_code = ?, verification_expires_at = ? WHERE id = ?", newEmail, otp, exp, id)
				if err == nil && h.alertManager != nil {
					_ = h.alertManager.SendVerificationOTP(newEmail, current.Username, otp)
				}
			}
			if err != nil {
				if strings.Contains(err.Error(), "Duplicate") {
					c.JSON(http.StatusConflict, gin.H{"error": "Email đã được sử dụng bởi tài khoản khác"})
					return
				}
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update email"})
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "User updated successfully"})
}

func (h *DashboardHandler) DeleteUser(c *gin.Context) {
	id := c.Param("id")
	
	_, err := h.database.Exec("DELETE FROM users WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

type VerifyEmailRequest struct {
	UserID int    `json:"user_id" binding:"required"`
	Code   string `json:"code" binding:"required"`
}

func (h *DashboardHandler) VerifyEmail(c *gin.Context) {
	var req VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mã OTP không hợp lệ"})
		return
	}

	var user models.User
	err := h.database.Get(&user, "SELECT * FROM users WHERE id = ?", req.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Không tìm thấy người dùng"})
		return
	}

	if user.Email == nil || *user.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tài khoản chưa được thiết lập email"})
		return
	}

	if user.IsVerified {
		c.JSON(http.StatusOK, gin.H{"message": "Email đã được xác thực trước đó", "is_verified": true})
		return
	}

	if user.VerificationCode == nil || *user.VerificationCode == "" || user.VerificationExpiresAt == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Chưa có mã OTP nào được tạo hoặc mã đã bị hủy"})
		return
	}

	if time.Now().After(*user.VerificationExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mã OTP đã hết hạn. Vui lòng nhấn gửi lại mã mới"})
		return
	}

	if strings.TrimSpace(req.Code) != strings.TrimSpace(*user.VerificationCode) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mã OTP không chính xác"})
		return
	}

	_, err = h.database.Exec("UPDATE users SET is_verified = 1, verification_code = NULL, verification_expires_at = NULL WHERE id = ?", req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi khi cập nhật trạng thái xác thực"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Xác thực email thành công! Thành viên hiện đã có thể được gán quản lý máy chủ.",
		"is_verified": true,
	})
}

type ResendCodeRequest struct {
	UserID int `json:"user_id" binding:"required"`
}

func (h *DashboardHandler) ResendVerificationCode(c *gin.Context) {
	var req ResendCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dữ liệu không hợp lệ"})
		return
	}

	var user models.User
	err := h.database.Get(&user, "SELECT * FROM users WHERE id = ?", req.UserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Không tìm thấy người dùng"})
		return
	}

	if user.Email == nil || strings.TrimSpace(*user.Email) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tài khoản chưa có địa chỉ email"})
		return
	}

	otp := generateOTPCode()
	exp := time.Now().Add(15 * time.Minute)
	_, err = h.database.Exec("UPDATE users SET verification_code = ?, verification_expires_at = ?, is_verified = 0 WHERE id = ?", otp, exp, req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi khi tạo mã OTP mới"})
		return
	}

	if h.alertManager != nil {
		err = h.alertManager.SendVerificationOTP(*user.Email, user.Username, otp)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể gửi email qua mail server: " + err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Đã gửi mã xác thực OTP mới đến email " + *user.Email})
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required"`
}

func (h *DashboardHandler) ChangePassword(c *gin.Context) {
	username := c.GetString("username")
	
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var currentHash string
	err := h.database.QueryRow("SELECT password_hash FROM users WHERE username = ?", username).Scan(&currentHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if !auth.CheckPasswordHash(req.CurrentPassword, currentHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid current password"})
		return
	}

	newHash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash new password"})
		return
	}

	_, err = h.database.Exec("UPDATE users SET password_hash = ? WHERE username = ?", newHash, username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}

func (h *DashboardHandler) GetMyProfile(c *gin.Context) {
	username := c.GetString("username")
	var user UserResponse
	err := h.database.Get(&user, "SELECT id, username, email, role, is_verified, created_at FROM users WHERE username = ?", username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Không tìm thấy người dùng"})
		return
	}
	c.JSON(http.StatusOK, user)
}

type UpdateMyEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
}

func (h *DashboardHandler) UpdateMyEmail(c *gin.Context) {
	username := c.GetString("username")
	var req UpdateMyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vui lòng nhập định dạng email hợp lệ"})
		return
	}

	newEmail := strings.TrimSpace(req.Email)

	var user models.User
	err := h.database.Get(&user, "SELECT * FROM users WHERE username = ?", username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Không tìm thấy người dùng"})
		return
	}

	otp := generateOTPCode()
	exp := time.Now().Add(15 * time.Minute)

	_, err = h.database.Exec(
		"UPDATE users SET email = ?, is_verified = 0, verification_code = ?, verification_expires_at = ? WHERE id = ?",
		newEmail, otp, exp, user.ID,
	)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate") {
			c.JSON(http.StatusConflict, gin.H{"error": "Email này đã được sử dụng bởi tài khoản khác"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể cập nhật email"})
		return
	}

	if h.alertManager != nil {
		_ = h.alertManager.SendVerificationOTP(newEmail, user.Username, otp)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Đã lưu email và gửi mã xác thực OTP 6 số từ admin@c500.net đến " + newEmail,
		"email":       newEmail,
		"user_id":     user.ID,
		"is_verified": false,
	})
}


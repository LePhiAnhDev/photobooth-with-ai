import cv2
import mediapipe as mp
import numpy as np
import math
import time
import os

class HandGestureRecognizer:
    def __init__(self):
        # Khởi tạo MediaPipe
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,  # Chỉ nhận diện 1 tay
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.mp_draw = mp.solutions.drawing_utils
        
        # Các biến điều khiển
        self.zoom_level = 1.0  # Mức zoom hiện tại
        self.min_zoom = 1.0    # Zoom tối thiểu
        self.max_zoom = 3.0    # Zoom tối đa
        self.zoom_step = 0.1   # Bước nhảy zoom
        
        # Biến để tránh chụp ảnh liên tục
        self.last_capture_time = 0
        self.capture_cooldown = 2.0  # 2 giây cooldown
        
        # Tạo thư mục lưu ảnh nếu chưa có
        if not os.path.exists('captured_images'):
            os.makedirs('captured_images')

    def calculate_distance(self, point1, point2):
        """Tính khoảng cách giữa 2 điểm landmark"""
        return math.sqrt((point1.x - point2.x)**2 + (point1.y - point2.y)**2)

    def is_finger_up(self, landmarks, tip_id, pip_id):
        """Kiểm tra ngón tay có duỗi thẳng không"""
        return landmarks[tip_id].y < landmarks[pip_id].y

    def recognize_gesture(self, landmarks):
        """
        Nhận diện cử chỉ tay dựa trên landmarks
        Returns: 'fist', 'open', 'ok', hoặc 'unknown'
        """
        # Các chỉ số landmark quan trọng
        thumb_tip = 4
        thumb_ip = 3
        index_tip = 8
        index_pip = 6
        middle_tip = 12
        middle_pip = 10
        ring_tip = 16
        ring_pip = 14
        pinky_tip = 20
        pinky_pip = 18

        # Kiểm tra các ngón tay có duỗi thẳng không
        fingers_up = []
        
        # Ngón cái (kiểm tra theo chiều ngang)
        if landmarks[thumb_tip].x > landmarks[thumb_ip].x:  # Tay phải
            fingers_up.append(landmarks[thumb_tip].x > landmarks[thumb_ip].x)
        else:  # Tay trái
            fingers_up.append(landmarks[thumb_tip].x < landmarks[thumb_ip].x)
        
        # 4 ngón còn lại
        for tip, pip in [(index_tip, index_pip), (middle_tip, middle_pip), 
                        (ring_tip, ring_pip), (pinky_tip, pinky_pip)]:
            fingers_up.append(self.is_finger_up(landmarks, tip, pip))

        fingers_up_count = fingers_up.count(True)

        # Nhận diện cử chỉ OK: ngón cái và ngón trỏ chạm nhau, các ngón khác duỗi
        thumb_index_distance = self.calculate_distance(landmarks[thumb_tip], landmarks[index_tip])
        
        if thumb_index_distance < 0.05:  # Ngón cái và trỏ gần nhau
            if fingers_up[2] and fingers_up[3] and fingers_up[4]:  # 3 ngón còn lại duỗi
                return 'ok'

        # Nhận diện nắm tay: tất cả ngón tay cụp lại
        if fingers_up_count <= 1:
            return 'fist'
        
        # Nhận diện mở tay: hầu hết ngón tay duỗi
        elif fingers_up_count >= 4:
            return 'open'
        
        return 'unknown'

    def apply_zoom(self, frame):
        """Áp dụng zoom vào frame"""
        if self.zoom_level == 1.0:
            return frame
        
        h, w = frame.shape[:2]
        
        # Tính toán vùng crop để zoom
        crop_h = int(h / self.zoom_level)
        crop_w = int(w / self.zoom_level)
        
        start_x = (w - crop_w) // 2
        start_y = (h - crop_h) // 2
        
        # Crop và resize về kích thước ban đầu
        cropped = frame[start_y:start_y + crop_h, start_x:start_x + crop_w]
        zoomed = cv2.resize(cropped, (w, h))
        
        return zoomed

    def capture_image(self, frame):
        """Chụp và lưu ảnh"""
        current_time = time.time()
        if current_time - self.last_capture_time > self.capture_cooldown:
            timestamp = int(current_time)
            filename = f'captured_images/capture_{timestamp}.jpg'
            cv2.imwrite(filename, frame)
            print(f"📸 Đã chụp ảnh: {filename}")
            self.last_capture_time = current_time
            return True
        return False

    def run(self):
        """Chạy chương trình chính"""
        # Khởi tạo camera
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print("❌ Không thể mở camera!")
            return
        
        print("🚀 Bắt đầu nhận diện cử chỉ tay...")
        print("📋 Hướng dẫn:")
        print("   👊 Nắm tay → Zoom Out")
        print("   ✋ Mở tay → Zoom In") 
        print("   👌 OK sign → Chụp ảnh")
        print("   ⌨️  Nhấn 'q' để thoát")
        
        while True:
            success, frame = cap.read()
            if not success:
                print("❌ Không thể đọc frame từ camera!")
                break
            
            # Lật frame theo chiều ngang để có cảm giác như nhìn gương
            frame = cv2.flip(frame, 1)
            h, w, c = frame.shape
            
            # Chuyển đổi BGR sang RGB cho MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Xử lý nhận diện tay
            results = self.hands.process(rgb_frame)
            
            gesture = 'unknown'
            
            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    # Vẽ landmarks lên frame
                    self.mp_draw.draw_landmarks(
                        frame, hand_landmarks, self.mp_hands.HAND_CONNECTIONS,
                        self.mp_draw.DrawingSpec(color=(0, 255, 0), thickness=2),
                        self.mp_draw.DrawingSpec(color=(255, 0, 0), thickness=2)
                    )
                    
                    # Nhận diện cử chỉ
                    gesture = self.recognize_gesture(hand_landmarks.landmark)
                    
                    # Xử lý các hành động dựa trên cử chỉ
                    if gesture == 'fist':
                        # Zoom out
                        if self.zoom_level > self.min_zoom:
                            self.zoom_level = max(self.min_zoom, self.zoom_level - self.zoom_step)
                    
                    elif gesture == 'open':
                        # Zoom in
                        if self.zoom_level < self.max_zoom:
                            self.zoom_level = min(self.max_zoom, self.zoom_level + self.zoom_step)
                    
                    elif gesture == 'ok':
                        # Chụp ảnh
                        if self.capture_image(frame):
                            # Hiệu ứng flash khi chụp
                            flash_frame = np.ones_like(frame) * 255
                            cv2.imshow('Hand Gesture Control', flash_frame)
                            cv2.waitKey(100)
            
            # Áp dụng zoom
            display_frame = self.apply_zoom(frame)
            
            # Hiển thị thông tin trên màn hình
            info_text = [
                f"Gesture: {gesture}",
                f"Zoom: {self.zoom_level:.1f}x",
                "Press 'q' to quit"
            ]
            
            for i, text in enumerate(info_text):
                y_pos = 30 + i * 30
                cv2.putText(display_frame, text, (10, y_pos), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                cv2.putText(display_frame, text, (10, y_pos), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 1)
            
            # Hiển thị frame
            cv2.imshow('Hand Gesture Control', display_frame)
            
            # Thoát khi nhấn 'q'
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        # Dọn dẹp
        cap.release()
        cv2.destroyAllWindows()
        print("👋 Chương trình đã kết thúc!")

def main():
    """Hàm main để chạy chương trình"""
    try:
        recognizer = HandGestureRecognizer()
        recognizer.run()
    except KeyboardInterrupt:
        print("\n⚡ Chương trình bị ngắt bởi người dùng!")
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        print("💡 Hãy đảm bảo bạn đã cài đặt: pip install opencv-python mediapipe numpy")

if __name__ == "__main__":
    main()
import cv2
import mediapipe as mp
import numpy as np
import math
import time
import os
import asyncio
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
from typing import Dict, List
import json

app = FastAPI()

# CORS middleware để frontend có thể kết nối
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HandGestureRecognizer:
    def __init__(self):
        # Khởi tạo MediaPipe với settings tối ưu
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,  # Chỉ nhận diện 1 tay
            min_detection_confidence=0.8,  # ✅ Tăng confidence để chính xác hơn
            min_tracking_confidence=0.7   # ✅ Tăng confidence để chính xác hơn
        )
        
        # Các biến điều khiển
        self.zoom_level = 1.0  # Mức zoom hiện tại
        self.min_zoom = 1.0    # Zoom tối thiểu
        self.max_zoom = 3.0    # Zoom tối đa
        self.zoom_step = 0.2   # Tăng bước nhảy zoom để phản hồi nhanh hơn
        
        # Biến mode và capture
        self.mode = "OFF"  # OFF hoặc ON
        self.is_capturing = False
        self.captured_photos = []
        self.max_photos = 6
        self.countdown = 0
        self.last_ok_detection = 0
        self.ok_cooldown = 1.0  # ✅ Giảm cooldown xuống 1 giây để dễ test
        self.last_countdown_update = 0
        self.countdown_interval = 1.0  # 1 giây giữa các countdown
        self.requires_ok_continuous = False  # Không yêu cầu OK sign liên tục
        
        # ✅ THÊM: Biến để đếm số lần Peace sign liên tục
        self.peace_sign_count = 0
        self.required_peace_count = 3  # Cần 3 frame liên tục để tránh false positive
        self.last_gesture = 'unknown'
        self.gesture_stability_count = 0  # Đếm số frame ổn định của gesture
        
        # Tạo thư mục lưu ảnh nếu chưa có
        if not os.path.exists('captured_images'):
            os.makedirs('captured_images')

    def calculate_distance(self, point1, point2):
        """Tính khoảng cách giữa 2 điểm landmark"""
        return math.sqrt((point1.x - point2.x)**2 + (point1.y - point2.y)**2)

    def is_finger_up(self, landmarks, tip_id, pip_id):
        """Kiểm tra ngón tay có duỗi thẳng không"""
        return landmarks[tip_id].y < landmarks[pip_id].y
    
    def is_thumb_up(self, landmarks):
        """Kiểm tra ngón cái có duỗi thẳng không (xử lý riêng cho ngón cái)"""
        thumb_tip = 4
        thumb_ip = 3
        thumb_mcp = 2
        
        # Kiểm tra theo hướng của tay (trái/phải)
        # Ngón cái duỗi khi tip xa hơn so với các khớp khác
        horizontal_extended = abs(landmarks[thumb_tip].x - landmarks[thumb_mcp].x) > abs(landmarks[thumb_ip].x - landmarks[thumb_mcp].x)
        vertical_extended = landmarks[thumb_tip].y < landmarks[thumb_ip].y
        
        # Kết hợp cả 2 tiêu chí để chính xác hơn
        return horizontal_extended and vertical_extended

    def recognize_gesture(self, landmarks):
        """
        Nhận diện cử chỉ tay dựa trên landmarks
        Returns: 'fist', 'open', 'peace', hoặc 'unknown'
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
        
        # ✅ Ngón cái - sử dụng logic cải tiến
        fingers_up.append(self.is_thumb_up(landmarks))
        
        # ✅ 4 ngón còn lại - sử dụng logic chuẩn
        for tip, pip in [(index_tip, index_pip), (middle_tip, middle_pip), 
                        (ring_tip, ring_pip), (pinky_tip, pinky_pip)]:
            fingers_up.append(self.is_finger_up(landmarks, tip, pip))

        fingers_up_count = fingers_up.count(True)

        # Loại bỏ debug log để tăng performance
        
        # ✅ PEACE SIGN CHÍNH XÁC: Dấu ✌🏻 (peace sign)
        # Có thể có 2 hoặc 3 ngón duỗi (ngón cái có thể duỗi hoặc không)
        peace_condition_1 = (fingers_up_count == 2 and 
                            not fingers_up[0] and  # Ngón cái cụp
                            fingers_up[1] and      # Ngón trỏ duỗi  
                            fingers_up[2] and      # Ngón giữa duỗi
                            not fingers_up[3] and  # Ngón áp út cụp
                            not fingers_up[4])     # Ngón út cụp
        
        peace_condition_2 = (fingers_up_count == 3 and 
                            fingers_up[0] and      # Ngón cái duỗi (có thể)
                            fingers_up[1] and      # Ngón trỏ duỗi
                            fingers_up[2] and      # Ngón giữa duỗi
                            not fingers_up[3] and  # Ngón áp út cụp
                            not fingers_up[4])     # Ngón út cụp
        
        if peace_condition_1 or peace_condition_2:
            return 'peace'

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
        if len(self.captured_photos) >= self.max_photos:
            return False
            
        timestamp = int(time.time() * 1000)
        filename = f'captured_images/capture_{timestamp}.jpg'
        cv2.imwrite(filename, frame)
        
        # Encode ảnh thành base64 để gửi qua WebSocket (chất lượng cao)
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        photo_data = {
            'id': str(timestamp),
            'dataUrl': f'data:image/jpeg;base64,{img_base64}',
            'timestamp': timestamp
        }
        
        self.captured_photos.append(photo_data)
        return True

    def process_frame(self, frame):
        """Xử lý frame và trả về thông tin cần thiết - CLEAN VERSION"""
        # Lật frame theo chiều ngang để có cảm giác như nhìn gương
        frame = cv2.flip(frame, 1)
        
        # Resize frame để tăng tốc độ xử lý
        small_frame = cv2.resize(frame, (320, 240))
        rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        
        # Xử lý nhận diện tay
        results = self.hands.process(rgb_frame)
        gesture = 'unknown'
        current_time = time.time()
        
        # Xử lý khi có tay được phát hiện
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                gesture = self.recognize_gesture(hand_landmarks.landmark)
                
                # Xử lý các gesture
                if gesture == 'fist':
                    if self.zoom_level > self.min_zoom:
                        self.zoom_level = max(self.min_zoom, self.zoom_level - self.zoom_step)
                        
                elif gesture == 'open':
                    if self.zoom_level < self.max_zoom:
                        self.zoom_level = min(self.max_zoom, self.zoom_level + self.zoom_step)
                        
                elif gesture == 'peace':
                    self._handle_peace_sign(current_time)
                
                # Reset counters cho các gesture khác
                if gesture != 'peace' and gesture != self.last_gesture:
                    self.peace_sign_count = 0
                    self.gesture_stability_count = 0
        
        # Cập nhật last_gesture
        self.last_gesture = gesture
        
        # Xử lý countdown và chụp ảnh
        self._handle_countdown_and_capture(current_time, frame)
        
        # Áp dụng zoom và chuẩn bị output
        display_frame = self.apply_zoom(frame)
        _, buffer = cv2.imencode('.jpg', display_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        frame_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return {
            'frame': f'data:image/jpeg;base64,{frame_base64}',
            'gesture': gesture,
            'zoom_level': round(self.zoom_level, 1),
            'mode': self.mode,
            'is_capturing': self.is_capturing,
            'countdown': self.countdown,
            'captured_photos': self.captured_photos,
            'photos_count': len(self.captured_photos),
            'peace_sign_count': self.peace_sign_count,
            'required_peace_count': self.required_peace_count,
            'gesture_stability_count': self.gesture_stability_count,
            'gesture_stability_required': self.required_peace_count
        }
    
    def _handle_peace_sign(self, current_time):
        """Xử lý logic Peace Sign - CLEAN VERSION"""
        # Đếm stability
        if self.last_gesture == 'peace':
            self.gesture_stability_count += 1
        else:
            self.gesture_stability_count = 1
        
        # Kích hoạt khi đủ điều kiện
        if (self.gesture_stability_count >= self.required_peace_count and 
            current_time - self.last_ok_detection > self.ok_cooldown and
            self.mode == "OFF" and not self.is_capturing):
            
            self.last_ok_detection = current_time
            self.mode = "ON"
            self.is_capturing = True
            self.countdown = 5
            self.last_countdown_update = current_time
            self.peace_sign_count = 0
            self.gesture_stability_count = 0
    
    def _handle_countdown_and_capture(self, current_time, frame):
        """Xử lý countdown và chụp ảnh"""
        if self.is_capturing and self.countdown > 0:
            if current_time - self.last_countdown_update >= self.countdown_interval:
                self.countdown -= 1
                self.last_countdown_update = current_time
                
                if self.countdown == 0:
                    if self.capture_image(frame):
                        if len(self.captured_photos) < self.max_photos:
                            self.countdown = 5
                            self.last_countdown_update = current_time
                        else:
                            self._reset_capture_mode()
                    else:
                        self._reset_capture_mode()
    
    def _reset_capture_mode(self):
        """Reset capture mode về OFF"""
        self.is_capturing = False
        self.mode = "OFF"
        self.countdown = 0
        self.peace_sign_count = 0
        self.gesture_stability_count = 0

# Khởi tạo recognizer
recognizer = HandGestureRecognizer()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    # Khởi tạo camera với settings cân bằng chất lượng và tốc độ
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)  # Độ phân giải cao cho chất lượng tốt
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)  # Độ phân giải cao cho chất lượng tốt
    cap.set(cv2.CAP_PROP_FPS, 30)            # FPS ổn định
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)      # Giảm buffer để giảm delay
    
    if not cap.isOpened():
        await websocket.send_text(json.dumps({"error": "Cannot open camera"}))
        return
    
    try:
        while True:
            success, frame = cap.read()
            if not success:
                break
            
            # Xử lý frame
            result = recognizer.process_frame(frame)
            
            # Gửi kết quả qua WebSocket
            await websocket.send_text(json.dumps(result))
            
            # Delay nhỏ để tránh quá tải (FPS ổn định)
            await asyncio.sleep(0.033)  # ~30 FPS
            
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        cap.release()
        manager.disconnect(websocket)

@app.post("/toggle_mode")
async def toggle_mode():
    """API để toggle mode ON/OFF"""
    current_time = time.time()
    
    if recognizer.mode == "OFF" and not recognizer.is_capturing:
        recognizer.mode = "ON"
        recognizer.is_capturing = True
        recognizer.countdown = 5
        recognizer.last_countdown_update = current_time
    elif recognizer.mode == "ON" or recognizer.is_capturing:
        recognizer.mode = "OFF"
        recognizer.is_capturing = False
        recognizer.countdown = 0
    
    return {
        "mode": recognizer.mode,
        "is_capturing": recognizer.is_capturing,
        "countdown": recognizer.countdown
    }

@app.get("/status")
async def get_status():
    """API để lấy trạng thái hiện tại"""
    return {
        "mode": recognizer.mode,
        "zoom_level": recognizer.zoom_level,
        "is_capturing": recognizer.is_capturing,
        "countdown": recognizer.countdown,
        "photos_count": len(recognizer.captured_photos),
        "max_photos": recognizer.max_photos
    }

@app.post("/reset")
async def reset_photos():
    """API để reset tất cả ảnh đã chụp"""
    recognizer.captured_photos = []
    recognizer.mode = "OFF"
    recognizer.is_capturing = False
    recognizer.countdown = 0
    recognizer.last_ok_detection = 0
    recognizer.last_countdown_update = 0
    recognizer.peace_sign_count = 0
    recognizer.last_gesture = 'unknown'
    recognizer.gesture_stability_count = 0
    return {"message": "Reset successful"}

@app.get("/")
async def root():
    return {"message": "Photobooth AI Backend is running!"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

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
            min_detection_confidence=0.6,  # Giảm để tăng tốc độ
            min_tracking_confidence=0.4   # Giảm để tăng tốc độ
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
        self.ok_cooldown = 2.0  # 2 giây cooldown cho OK sign
        self.last_countdown_update = 0
        self.countdown_interval = 1.0  # 1 giây giữa các countdown
        self.requires_ok_continuous = False  # Không yêu cầu OK sign liên tục
        
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
        print(f"📸 Đã chụp ảnh: {filename} ({len(self.captured_photos)}/{self.max_photos})")
        return True

    def process_frame(self, frame):
        """Xử lý frame và trả về thông tin cần thiết (tối ưu tốc độ)"""
        # Lật frame theo chiều ngang để có cảm giác như nhìn gương
        frame = cv2.flip(frame, 1)
        h, w, c = frame.shape
        
        # Resize frame để tăng tốc độ xử lý
        small_frame = cv2.resize(frame, (320, 240))
        
        # Chuyển đổi BGR sang RGB cho MediaPipe
        rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        
        # Xử lý nhận diện tay
        results = self.hands.process(rgb_frame)
        
        gesture = 'unknown'
        current_time = time.time()
        
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
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
                    # OK sign - chuyển mode ON và bắt đầu chụp ảnh (chỉ cần 1 lần)
                    if current_time - self.last_ok_detection > self.ok_cooldown:
                        self.last_ok_detection = current_time
                        if self.mode == "OFF" and not self.is_capturing:
                            self.mode = "ON"
                            self.is_capturing = True
                            self.countdown = 5  # 5 giây countdown
                            self.last_countdown_update = current_time
                            print("🔄 Chuyển Mode: ON - Bắt đầu countdown...")
        
        # Xử lý countdown và chụp ảnh với timer chính xác
        if self.is_capturing and self.countdown > 0:
            # Chỉ giảm countdown mỗi giây, không phải mỗi frame
            if current_time - self.last_countdown_update >= self.countdown_interval:
                self.countdown -= 1
                self.last_countdown_update = current_time
                print(f"⏰ Countdown: {self.countdown}")
                
                if self.countdown == 0:
                    if self.capture_image(frame):
                        if len(self.captured_photos) < self.max_photos:
                            self.countdown = 5  # Tiếp tục countdown 5 giây cho ảnh tiếp theo
                            self.last_countdown_update = current_time
                            print(f"📸 Chụp ảnh {len(self.captured_photos)}/{self.max_photos} - Tiếp tục countdown...")
                        else:
                            self.is_capturing = False
                            self.mode = "OFF"
                            self.countdown = 0
                            print("✅ Hoàn thành chụp 6 ảnh - Chuyển Mode: OFF")
                    else:
                        self.is_capturing = False
                        self.mode = "OFF"
                        self.countdown = 0
                        print("❌ Lỗi chụp ảnh - Chuyển Mode: OFF")
        
        # Không cần kiểm tra OK sign timeout vì không yêu cầu liên tục
        
        # Áp dụng zoom
        display_frame = self.apply_zoom(frame)
        
        # Encode frame để gửi qua WebSocket (giữ chất lượng cao)
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
            'photos_count': len(self.captured_photos)
        }

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
    print("🔌 Client connected to WebSocket")
    
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
            
    except WebSocketDisconnect:
        print("🔌 Client disconnected from WebSocket")
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
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
        print("🔄 Mode switched to ON - Manual toggle")
    elif recognizer.mode == "ON" or recognizer.is_capturing:
        recognizer.mode = "OFF"
        recognizer.is_capturing = False
        recognizer.countdown = 0
        print("🔄 Mode switched to OFF - Manual toggle")
    
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
    print("🔄 Reset photos and mode")
    return {"message": "Reset successful"}

@app.get("/")
async def root():
    return {"message": "Photobooth AI Backend is running!"}

if __name__ == "__main__":
    print("🚀 Starting Photobooth AI Backend...")
    print("📋 Features:")
    print("   👊 Fist → Zoom Out (1x-3x)")
    print("   ✋ Open Hand → Zoom In (1x-3x)")
    print("   👌 OK Sign → Auto Mode ON + Capture 6 photos")
    print("   🔄 Mode Toggle: OFF (gesture only) / ON (capture mode)")
    print("🌐 WebSocket: ws://localhost:8000/ws")
    print("🌐 API: http://localhost:8000")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)

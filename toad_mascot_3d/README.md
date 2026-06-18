# 3D Toad Mascot Cursor Follow

Bộ này tạo mascot con cóc/cóc cam dạng 3D bằng primitives của Three.js, có hiệu ứng xoay theo chuột giống kiểu mascot MetaMask.

## Chạy bản HTML

Cách nhanh nhất:

```bash
cd toad_mascot_3d
python3 -m http.server 5173
```

Sau đó mở:

```text
http://localhost:5173/toad_mascot_3d.html
```

## Dùng trong React/Vite

Cài thư viện:

```bash
npm i three @react-three/fiber
```

Copy `ToadMascot3D.jsx` vào `src/components/ToadMascot3D.jsx`, rồi import:

```jsx
import ToadMascot3D from './components/ToadMascot3D';

export default function App() {
  return <ToadMascot3D />;
}
```

## Chỉnh chuyển động

Trong file HTML, tìm các dòng này:

```js
mascot.rotation.y = smoothPointer.x * 0.38;
mascot.rotation.x = -smoothPointer.y * 0.13;
leftPupil.position.x = 0.08 + smoothPointer.x * 0.07;
```

- Tăng `0.38` để đầu xoay mạnh hơn.
- Giảm `0.075` trong `smoothPointer.lerp(pointer, 0.075)` để chuyển động chậm/mượt hơn.
- Tăng `0.07` để mắt đảo mạnh hơn.

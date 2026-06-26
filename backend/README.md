# Local Image-to-URL API Service

A lightweight, local Node.js API service that accepts image uploads and returns their absolute localhost URLs.

## Project Structure

```
image_to_url/
├── uploads/            # Directory where uploaded images are saved
├── package.json        # Dependencies and scripts
├── server.js           # Main Express server and upload logic
└── README.md           # Instructions and documentation
```

## Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### 2. Installation
To install the dependencies, run:
```bash
npm install
```

### 3. Start the Server
* **Development Mode** (with automatic restarts on code changes):
  ```bash
  npm run dev
  ```
* **Production Mode**:
  ```bash
  npm start
  ```

---

## API Documentation

### 1. Root Endpoint
* **URL:** `http://localhost:3005/`
* **Method:** `GET`
* **Response:**
  ```json
  {
    "message": "Welcome to the Local Image-to-URL API Service!",
    "status": "Running",
    "upload_endpoint": "/api/v1/upload (POST with field name \"image\")"
  }
  ```

### 2. Upload Image Endpoint
* **URL:** `http://localhost:3005/api/v1/upload`
* **Method:** `POST`
* **Content-Type:** `multipart/form-data`
* **Form Field Name:** `image` (should contain the image file)
* **Response (Success):**
  ```json
  {
    "success": true,
    "message": "Image uploaded successfully!",
    "data": {
      "filename": "image-1718970000000-987654321.jpg",
      "mimetype": "image/jpeg",
      "size": "0.15 MB",
      "url": "http://localhost:3005/uploads/image-1718970000000-987654321.jpg"
    }
  }
  ```

* **Response (Error - Non-Image File):**
  ```json
  {
    "success": false,
    "error": "Only image files are allowed!"
  }
  ```

---

## How to Test the API

### Method A: Using `curl` (Terminal)
Run the following command in your terminal (replace `path/to/your/photo.jpg` with an actual image path):
```bash
curl -X POST -F "image=@path/to/your/photo.jpg" http://localhost:3005/api/v1/upload
```

### Method B: Using Postman / Thunder Client / Insomnia
1. Set method to **POST** and URL to `http://localhost:3005/api/v1/upload`.
2. Go to the **Body** tab.
3. Select **form-data**.
4. Add a key named `image`. Change the type of key from `text` to `file`.
5. Upload an image file under the value column.
6. Click **Send**.

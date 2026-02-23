import pytesseract
from PIL import Image
from backend.core.config import settings
import shutil


def configure_tesseract():
    if settings.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

    if not shutil.which("tesseract") and not settings.TESSERACT_CMD:
        raise RuntimeError("Tesseract not installed or not in PATH.")


_configured = False


def ensure_configured():
    global _configured
    if not _configured:
        configure_tesseract()
        _configured = True


def extract_text_from_image(image_path: str) -> str:
    ensure_configured()

    image = Image.open(image_path)
    text = pytesseract.image_to_string(image)
    image.close()

    return text.strip()

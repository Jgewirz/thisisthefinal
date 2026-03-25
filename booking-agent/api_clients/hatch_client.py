"""
Hatch REST API Client — controls Hatch Rest/Restore sound machines via AWS IoT MQTT.

Uses the community `hatch-rest-api` library which reverse-engineers Hatch's
AWS Cognito auth + AWS IoT MQTT device control protocol.

Connection lifecycle: connect on-demand → execute command → disconnect.
No persistent MQTT connection (adds ~2-3s latency but much simpler).

Credential storage: email/password in profiles/{user_id}/hatch_session.json
(password needed each time — Hatch uses short-lived AWS Cognito tokens).
"""

import json
import time
from pathlib import Path

# Sound name mapping — common names to Hatch sound IDs
# The hatch-rest-api library handles actual sound enumeration per device model
COMMON_SOUNDS = {
    "white noise": "white_noise",
    "pink noise": "pink_noise",
    "brown noise": "brown_noise",
    "ocean": "ocean",
    "rain": "rain",
    "wind": "wind",
    "birds": "birds",
    "crickets": "crickets",
    "thunderstorm": "thunderstorm",
    "stream": "stream",
    "heartbeat": "heartbeat",
    "dryer": "dryer",
    "fan": "fan",
    "water": "water",
    "waves": "waves",
}


def get_session_path(user_id: str) -> str:
    return f"profiles/{user_id}/hatch_session.json"


def has_hatch_session(user_id: str) -> bool:
    return Path(get_session_path(user_id)).exists()


def load_hatch_session(user_id: str) -> dict | None:
    path = get_session_path(user_id)
    if not Path(path).exists():
        return None
    try:
        return json.loads(Path(path).read_text())
    except Exception:
        return None


def save_hatch_session(user_id: str, email: str, password: str, devices: list[dict]):
    path = get_session_path(user_id)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    data = {
        "email": email,
        "password": password,
        "devices": devices,
        "lastDeviceSync": time.time(),
        "savedAt": time.time(),
    }
    Path(path).write_text(json.dumps(data, indent=2))


def normalize_sound_name(name: str) -> str:
    """Normalize a user-provided sound name to match Hatch's format."""
    lower = name.lower().strip()
    return COMMON_SOUNDS.get(lower, lower.replace(" ", "_"))


async def connect_and_get_devices(email: str, password: str) -> list[dict]:
    """
    Login to Hatch via AWS Cognito, connect to AWS IoT MQTT, discover devices.
    Returns list of device dicts with id, name, model, and online status.
    """
    from hatch_rest_api import get_rest_devices

    devices_raw = await get_rest_devices(email, password)

    devices = []
    for d in devices_raw:
        devices.append({
            "id": getattr(d, "thing_name", None) or getattr(d, "id", str(id(d))),
            "name": getattr(d, "name", "Hatch Device"),
            "model": getattr(d, "model", "unknown"),
            "is_on": getattr(d, "is_on", False),
            "volume": getattr(d, "volume", None),
            "brightness": getattr(d, "brightness", None),
            "color": {
                "r": getattr(d, "r", None),
                "g": getattr(d, "g", None),
                "b": getattr(d, "b", None),
            } if hasattr(d, "r") else None,
            "sound": getattr(d, "sound", None),
        })

    return devices


async def control_device(
    email: str,
    password: str,
    device_id: str | None,
    action: str,
    params: dict,
) -> dict:
    """
    Connect to Hatch, find device, execute control action, disconnect.

    Actions:
        turn_on     — power on the device
        turn_off    — power off the device
        set_sound   — set sound type (params: sound)
        set_volume  — set volume 0-100 (params: volume)
        set_brightness — set light brightness 0-100 (params: brightness)
        set_color   — set light color (params: r, g, b, brightness?)
    """
    from hatch_rest_api import get_rest_devices

    devices = await get_rest_devices(email, password)

    if not devices:
        return {"success": False, "error": "No Hatch devices found on this account"}

    # Find the target device
    target = None
    if device_id:
        for d in devices:
            did = getattr(d, "thing_name", None) or getattr(d, "id", None)
            if str(did) == str(device_id):
                target = d
                break
        if not target:
            return {"success": False, "error": f"Device '{device_id}' not found"}
    else:
        target = devices[0]

    device_name = getattr(target, "name", "Hatch Device")

    try:
        if action == "turn_on":
            target.set_power(True)
            return {"success": True, "action": "turn_on", "device": device_name, "message": f"{device_name} turned on"}

        elif action == "turn_off":
            target.set_power(False)
            return {"success": True, "action": "turn_off", "device": device_name, "message": f"{device_name} turned off"}

        elif action == "set_sound":
            sound = normalize_sound_name(params.get("sound", "white_noise"))
            volume = params.get("volume")
            target.set_sound(sound)
            if volume is not None:
                target.set_volume(int(volume))
            return {
                "success": True,
                "action": "set_sound",
                "device": device_name,
                "sound": sound,
                "volume": volume,
                "message": f"Playing {sound.replace('_', ' ')} on {device_name}" + (f" at {volume}% volume" if volume else ""),
            }

        elif action == "set_volume":
            volume = int(params.get("volume", 50))
            target.set_volume(volume)
            return {"success": True, "action": "set_volume", "device": device_name, "volume": volume, "message": f"{device_name} volume set to {volume}%"}

        elif action == "set_brightness":
            brightness = int(params.get("brightness", 50))
            target.set_brightness(brightness)
            return {"success": True, "action": "set_brightness", "device": device_name, "brightness": brightness, "message": f"{device_name} brightness set to {brightness}%"}

        elif action == "set_color":
            r = int(params.get("r", 255))
            g = int(params.get("g", 150))
            b = int(params.get("b", 50))
            brightness = params.get("brightness")
            target.set_color(r, g, b)
            if brightness is not None:
                target.set_brightness(int(brightness))
            return {
                "success": True,
                "action": "set_color",
                "device": device_name,
                "color": {"r": r, "g": g, "b": b},
                "brightness": brightness,
                "message": f"{device_name} light color updated",
            }

        else:
            return {"success": False, "error": f"Unknown action: {action}"}

    except Exception as e:
        return {"success": False, "error": f"Control failed: {str(e)[:200]}", "device": device_name}

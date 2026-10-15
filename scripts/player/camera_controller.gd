class_name CameraController
extends Node3D

@export var mouse_sensitivity: float = 0.003
@export var follow_speed: float = 14.0
@export var target_offset: Vector3 = Vector3(0.0, 1.45, 0.0)
@onready var target: Node3D = get_parent() as Node3D
@onready var spring_arm: SpringArm3D = $SpringArm3D
@onready var camera: Camera3D = $SpringArm3D/Camera3D
var camera_active: bool = true

func _ready() -> void:
	# A top-level pivot follows smoothly without inheriting player transforms.
	top_level = true
	global_position = target.global_position + target_offset
	rotation.x = deg_to_rad(-15.0)
	spring_arm.add_excluded_object((target as CollisionObject3D).get_rid())
	set_camera_active(true)

func _process(delta: float) -> void:
	global_position = global_position.lerp(target.global_position + target_offset, 1.0 - exp(-follow_speed * delta))

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotation.y -= event.relative.x * mouse_sensitivity
		rotation.x = clampf(rotation.x - event.relative.y * mouse_sensitivity, deg_to_rad(-60.0), deg_to_rad(45.0))

func set_camera_active(active: bool) -> void:
	camera_active = active
	set_process(active)
	set_process_unhandled_input(active)
	camera.current = active
	if active:
		global_position = target.global_position + target_offset
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

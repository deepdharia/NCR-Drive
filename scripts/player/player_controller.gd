class_name PlayerController
extends CharacterBody3D

@export var walk_speed: float = 3.5
@export var sprint_speed: float = 7.0
@export var jump_velocity: float = 5.0
@export var acceleration: float = 20.0
@export var turn_speed: float = 12.0

@onready var body_mesh: Node3D = $BodyMesh
@onready var collider: CollisionShape3D = $CollisionShape3D
@onready var orbit_camera: CameraController = $CameraPivot
var gravity: float = float(ProjectSettings.get_setting("physics/3d/default_gravity", 9.8))
var player_active: bool = true
var saved_layer: int
var saved_mask: int

func _ready() -> void:
	saved_layer = collision_layer
	saved_mask = collision_mask

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= gravity * delta
	elif Input.is_action_just_pressed("jump"):
		velocity.y = jump_velocity
	var axis: Vector2 = Input.get_vector("move_left", "move_right", "move_forward", "move_backward")
	var camera: Camera3D = get_viewport().get_camera_3d()
	var camera_basis: Basis = camera.global_basis if camera != null else global_basis
	var forward: Vector3 = -camera_basis.z
	forward.y = 0.0
	forward = forward.normalized()
	var right: Vector3 = forward.cross(Vector3.UP)
	var direction: Vector3 = right * axis.x - forward * axis.y
	var speed: float = sprint_speed if Input.is_action_pressed("sprint") else walk_speed
	velocity.x = move_toward(velocity.x, direction.x * speed, acceleration * delta)
	velocity.z = move_toward(velocity.z, direction.z * speed, acceleration * delta)
	if direction.length_squared() > 0.001:
		body_mesh.rotation.y = lerp_angle(body_mesh.rotation.y, atan2(-direction.x, -direction.z), 1.0 - exp(-turn_speed * delta))
	move_and_slide()

func set_player_active(active: bool) -> void:
	player_active = active
	velocity = Vector3.ZERO
	visible = active
	collision_layer = saved_layer if active else 0
	collision_mask = saved_mask if active else 0
	collider.set_deferred("disabled", not active)
	set_physics_process(active)
	orbit_camera.set_camera_active(active)

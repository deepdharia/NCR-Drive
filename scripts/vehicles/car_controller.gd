class_name CarController
extends VehicleBody3D

@export var drive_force: float = 1800.0
@export var reverse_force: float = 1000.0
@export var service_brake: float = 35.0
@export var parking_brake: float = 60.0
@export var max_steer: float = 0.48
@export var min_steer: float = 0.12
@export var steering_response: float = 4.0
@export var steering_fade_speed: float = 25.0
@export var forward_limit: float = 33.0
@export var reverse_limit: float = 8.0
@onready var chase_camera: Camera3D = $ChaseCamera
@onready var rear_left: VehicleWheel3D = $RearLeft
@onready var rear_right: VehicleWheel3D = $RearRight
var driving: bool = false

func _ready() -> void:
	# Allow the parked car to settle onto its suspension before sleeping.
	brake = parking_brake

func speed_kmh() -> float:
	return linear_velocity.length() * 3.6

func _physics_process(delta: float) -> void:
	if not driving:
		return
	# VehicleBody3D's forward axis is local +Z.
	var forward_speed: float = linear_velocity.dot(global_basis.z)
	var throttle: float = Input.get_axis("move_backward", "move_forward")
	engine_force = 0.0
	brake = 0.0
	if throttle * forward_speed < -0.5:
		brake = service_brake * absf(throttle)
	elif throttle > 0.0 and forward_speed < forward_limit:
		engine_force = throttle * drive_force
	elif throttle < 0.0 and forward_speed > -reverse_limit:
		engine_force = throttle * reverse_force
	var handbraking: bool = Input.is_action_pressed("handbrake")
	rear_left.brake = parking_brake if handbraking else 0.0
	rear_right.brake = parking_brake if handbraking else 0.0
	if handbraking:
		engine_force = 0.0
	var limit: float = lerpf(max_steer, min_steer, clampf(linear_velocity.length() / steering_fade_speed, 0.0, 1.0))
	# Positive steering turns +Z toward the vehicle's left (+X).
	var target_steering: float = Input.get_axis("move_right", "move_left") * limit
	steering = move_toward(steering, target_steering, steering_response * delta)

func set_driving(active: bool) -> void:
	driving = active
	chase_camera.current = active
	engine_force = 0.0
	steering = 0.0
	rear_left.brake = 0.0
	rear_right.brake = 0.0
	brake = 0.0 if active else parking_brake
	if not active:
		linear_velocity = Vector3.ZERO
		angular_velocity = Vector3.ZERO
	sleeping = not active

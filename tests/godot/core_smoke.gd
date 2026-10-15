extends SceneTree

var failures: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, message: String) -> void:
	if not condition:
		failures += 1
		push_error(message)

func frames(count: int) -> void:
	for index: int in range(count):
		await physics_frame

func interact(area: VehicleInteractArea) -> void:
	var event: InputEventAction = InputEventAction.new()
	event.action = "interact"
	event.pressed = true
	area._unhandled_input(event)

func run() -> void:
	var packed: PackedScene = load("res://scenes/maps/test_district.tscn") as PackedScene
	var world: Node3D = packed.instantiate() as Node3D
	root.add_child(world)
	var player: PlayerController = world.get_node("Player") as PlayerController
	var car: CarController = world.get_node("HatchbackParvaaz") as CarController
	var area: VehicleInteractArea = car.get_node("DriverDoorArea") as VehicleInteractArea
	await frames(120)
	check(player.is_on_floor(), "Player must settle on asphalt")
	check(area.nearby_player == player, "Door must detect player")
	interact(area)
	await frames(2)
	check(car.driving and not player.player_active, "Enter must transfer control")
	check(car.chase_camera.current and player.collider.disabled, "Enter must switch camera and collision")
	Input.action_press("move_forward")
	await frames(120)
	Input.action_release("move_forward")
	check(car.linear_velocity.dot(car.global_basis.z) > 1.0, "Throttle must propel car forward")
	Input.action_press("move_backward")
	await frames(180)
	Input.action_release("move_backward")
	check(car.linear_velocity.dot(car.global_basis.z) < -0.5, "Brake then reverse must move backward")
	Input.action_press("handbrake")
	await frames(2)
	check(car.rear_left.brake > 0.0 and car.engine_force == 0.0, "Handbrake must brake rear wheels and cut power")
	Input.action_release("handbrake")
	Input.action_press("move_left")
	await frames(15)
	check(car.steering > 0.0, "Left input must produce positive +Z vehicle steering")
	Input.action_release("move_left")
	car.linear_velocity = car.global_basis.z * 5.0
	interact(area)
	check(car.driving, "Exit must be rejected above 15 km/h")
	car.linear_velocity = Vector3.ZERO
	await frames(2)
	# Block the door with a real physics collider.
	var blocker: StaticBody3D = StaticBody3D.new()
	var shape: CollisionShape3D = CollisionShape3D.new()
	var box: BoxShape3D = BoxShape3D.new()
	box.size = Vector3(1, 3, 1)
	shape.shape = box
	blocker.add_child(shape)
	world.add_child(blocker)
	blocker.global_position = area.exit_marker.global_position + Vector3.UP
	await frames(2)
	check(not area.try_exit(), "Blocked door must reject exit")
	blocker.queue_free()
	await frames(2)
	check(area.try_exit(), "Clear door must allow exit")
	await frames(2)
	check(player.player_active and not car.driving, "Exit must restore player")
	check(player.orbit_camera.camera.current and not player.collider.disabled, "Exit must restore camera and collision")
	await frames(60)
	var start: Vector3 = player.global_position
	Input.action_press("move_forward")
	await frames(60)
	Input.action_release("move_forward")
	check(player.global_position.distance_to(start) > 2.5, "Walking must move player")
	Input.action_press("jump")
	await frames(2)
	Input.action_release("jump")
	check(player.velocity.y > 0.0, "Jump must lift player")
	print("CORE SMOKE: ", failures, " failures")
	quit(1 if failures > 0 else 0)

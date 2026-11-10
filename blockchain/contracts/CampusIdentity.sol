
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

contract CampusIdentity {

    // Two profile types, with identical permissions.
    enum Role {
        Student,
        Staff
    }

    // User profile structure.
    struct UserProfile {
        string name;
        Role role;
        uint256 registeredAt;
        bool isRegistered;
    }

    // Wallet address => user profile.
    mapping(address => UserProfile) private users;

    // Keep track of registered wallet addresses.
    address[] private registeredUsers;

    // Events
    event UserRegistered(
        address indexed userAddress,
        string name,
        Role role
    );

    event UserProfileUpdated(
        address indexed userAddress,
        string newName
    );

    // Register a new user.
    function registerUser(
        string memory _name,
        Role _role
    ) external {
        require(!users[msg.sender].isRegistered, "Already registered");
        require(bytes(_name).length > 0, "Name cannot be empty");

        users[msg.sender] = UserProfile({
            name: _name,
            role: _role,
            registeredAt: block.timestamp,
            isRegistered: true
        });

        registeredUsers.push(msg.sender);

        emit UserRegistered(msg.sender, _name, _role);
    }

    // Check whether a wallet address is registered.
    function isRegistered(
        address _user
    ) external view returns (bool) {
        return users[_user].isRegistered;
    }

    // Retrieve a user's complete profile.
    function getUserProfile(
        address _user
    ) external view returns (
        string memory name,
        Role role,
        uint256 registeredAt,
        bool registered
    ) {
        require(users[_user].isRegistered, "User not registered");

        UserProfile memory user = users[_user];

        return (
            user.name,
            user.role,
            user.registeredAt,
            user.isRegistered
        );
    }

    // Update the user's display name.
    function updateUserProfile(
        string memory _newName
    ) external {
        require(users[msg.sender].isRegistered, "User not registered");
        require(bytes(_newName).length > 0, "Name cannot be empty");

        users[msg.sender].name = _newName;

        emit UserProfileUpdated(msg.sender, _newName);
    }

    // Get the total number of registered users.
    function getUserCount() external view returns (uint256) {
        return registeredUsers.length;
    }

    // Get all registered wallet addresses.
    function getRegisteredUsers() external view returns (address[] memory) {
        return registeredUsers;
    }
}

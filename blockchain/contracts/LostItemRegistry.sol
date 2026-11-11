// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ICampusIdentity {
    function isRegistered(address user) external view returns (bool);
}

contract LostItemRegistry is ERC20 {
    uint256 public constant RETURN_REWARD = 10 * 10 ** 18;
    event ReturnRewardIssued(uint256 indexed itemId, address indexed reporter, uint256 amount);

    ICampusIdentity public campusIdentity;

    enum ItemType {
        Lost,
        Found
    }

    enum ItemStatus {
        Open,
        ClaimPending,
        ClaimAccepted,
        Returned,
        Closed
    }

    enum ClaimStatus {
        Pending,
        Accepted,
        Rejected,
        Cancelled,
        Completed
    }

    struct Item {
        uint256 id;
        address reporter;
        ItemType itemType;
        string title;
        string category;
        string description;
        string location;
        uint256 dateReported;
        string imageURI;
        ItemStatus status;
    }

    struct Claim {
        uint256 id;
        uint256 itemId;
        address claimant;
        string message;
        ClaimStatus status;
        bool reporterConfirmed;
        bool claimantConfirmed;
    }

    uint256 private nextItemId = 1;
    uint256 private nextClaimId = 1;

    mapping(uint256 => Item) private items;
    mapping(uint256 => Claim) private claims;

    mapping(uint256 => uint256[]) private itemClaimIds;
    mapping(uint256 => mapping(address => bool)) private hasClaimed;
    mapping(uint256 => uint256) private pendingClaimCount;

    uint256[] private allItemIds;

    event ItemReported(
        uint256 indexed itemId,
        address indexed reporter,
        ItemType itemType
    );

    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed itemId,
        address indexed claimant
    );

    event ClaimAccepted(uint256 indexed claimId);
    event ClaimRejected(uint256 indexed claimId);
    event ClaimCancelled(uint256 indexed claimId);

    event HandoverConfirmed(
        uint256 indexed claimId,
        address indexed confirmer
    );

    event ItemReturned(uint256 indexed itemId, uint256 indexed claimId);
    event ItemClosed(uint256 indexed itemId);

    modifier onlyRegistered() {
        require(
            campusIdentity.isRegistered(msg.sender),
            "User is not registered"
        );
        _;
    }

    modifier itemExists(uint256 itemId) {
        require(
            itemId > 0 && itemId < nextItemId,
            "Item does not exist"
        );
        _;
    }

    modifier claimExists(uint256 claimId) {
        require(
            claimId > 0 && claimId < nextClaimId,
            "Claim does not exist"
        );
        _;
    }

    constructor(address identityAddress) ERC20("LostChain Points", "LCP") {
        require(identityAddress != address(0), "Invalid identity address");
        require(identityAddress.code.length > 0, "Address is not a contract");

        campusIdentity = ICampusIdentity(identityAddress);
    }

    // ==========================================
    // 1. REPORT LOST OR FOUND ITEMS
    // ==========================================

    function reportLostItem(
        string memory title,
        string memory category,
        string memory description,
        string memory location,
        string memory imageURI
    ) external onlyRegistered {
        _reportItem(
            ItemType.Lost,
            title,
            category,
            description,
            location,
            imageURI
        );
    }

    function reportFoundItem(
        string memory title,
        string memory category,
        string memory description,
        string memory location,
        string memory imageURI
    ) external onlyRegistered {
        _reportItem(
            ItemType.Found,
            title,
            category,
            description,
            location,
            imageURI
        );
    }

    function _reportItem(
        ItemType itemType,
        string memory title,
        string memory category,
        string memory description,
        string memory location,
        string memory imageURI
    ) private {
        require(bytes(title).length > 0, "Title is required");

        uint256 itemId = nextItemId++;

        items[itemId] = Item({
            id: itemId,
            reporter: msg.sender,
            itemType: itemType,
            title: title,
            category: category,
            description: description,
            location: location,
            dateReported: block.timestamp,
            imageURI: imageURI,
            status: ItemStatus.Open
        });

        allItemIds.push(itemId);

        emit ItemReported(itemId, msg.sender, itemType);
    }

    // ==========================================
    // 2. SUBMIT A RECOVERY CLAIM
    // ==========================================

    function submitClaim(
        uint256 itemId,
        string memory message
    ) external onlyRegistered itemExists(itemId) {

        Item storage item = items[itemId];

        require(item.itemType == ItemType.Found, "Not a found item");
        require(
            item.status == ItemStatus.Open ||
            item.status == ItemStatus.ClaimPending,
            "Item is not available"
        );
        require(item.reporter != msg.sender, "Cannot claim own item");
        require(!hasClaimed[itemId][msg.sender], "Already claimed");

        uint256 claimId = nextClaimId++;

        claims[claimId] = Claim({
            id: claimId,
            itemId: itemId,
            claimant: msg.sender,
            message: message,
            status: ClaimStatus.Pending,
            reporterConfirmed: false,
            claimantConfirmed: false
        });

        itemClaimIds[itemId].push(claimId);
        hasClaimed[itemId][msg.sender] = true;
        pendingClaimCount[itemId]++;

        item.status = ItemStatus.ClaimPending;

        emit ClaimSubmitted(claimId, itemId, msg.sender);
    }

    // ==========================================
    // 3. ACCEPT A CLAIM
    // ==========================================

    function acceptClaim(
        uint256 claimId
    ) external onlyRegistered claimExists(claimId) {

        Claim storage claim = claims[claimId];
        Item storage item = items[claim.itemId];

        require(item.reporter == msg.sender, "Only reporter can accept");
        require(claim.status == ClaimStatus.Pending, "Claim not pending");
        require(
            item.status == ItemStatus.ClaimPending,
            "Item not accepting claims"
        );

        claim.status = ClaimStatus.Accepted;

        // Reject all other pending claims for this item.
        uint256[] storage ids = itemClaimIds[claim.itemId];

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 otherId = ids[i];

            if (
                otherId != claimId &&
                claims[otherId].status == ClaimStatus.Pending
            ) {
                claims[otherId].status = ClaimStatus.Rejected;
                emit ClaimRejected(otherId);
            }
        }

        pendingClaimCount[claim.itemId] = 0;
        item.status = ItemStatus.ClaimAccepted;

        emit ClaimAccepted(claimId);
    }

    // ==========================================
    // 4. REJECT A CLAIM
    // ==========================================

    function rejectClaim(
        uint256 claimId
    ) external onlyRegistered claimExists(claimId) {

        Claim storage claim = claims[claimId];
        Item storage item = items[claim.itemId];

        require(item.reporter == msg.sender, "Only reporter can reject");
        require(claim.status == ClaimStatus.Pending, "Claim not pending");

        claim.status = ClaimStatus.Rejected;
        pendingClaimCount[claim.itemId]--;

        if (pendingClaimCount[claim.itemId] == 0) {
            item.status = ItemStatus.Open;
        }

        emit ClaimRejected(claimId);
    }

    // ==========================================
    // 5. CANCEL A CLAIM
    // ==========================================

    function cancelClaim(
        uint256 claimId
    ) external onlyRegistered claimExists(claimId) {

        Claim storage claim = claims[claimId];
        Item storage item = items[claim.itemId];

        require(claim.claimant == msg.sender, "Only claimant can cancel");
        require(claim.status == ClaimStatus.Pending, "Claim not pending");

        claim.status = ClaimStatus.Cancelled;
        pendingClaimCount[claim.itemId]--;

        if (pendingClaimCount[claim.itemId] == 0) {
            item.status = ItemStatus.Open;
        }

        emit ClaimCancelled(claimId);
    }

    // ==========================================
    // 6. CONFIRM THE HANDOVER
    // ==========================================

    function confirmHandover(
        uint256 claimId
    ) external onlyRegistered claimExists(claimId) {

        Claim storage claim = claims[claimId];
        Item storage item = items[claim.itemId];

        require(
            claim.status == ClaimStatus.Accepted,
            "Claim has not been accepted"
        );

        if (msg.sender == item.reporter) {
            require(!claim.reporterConfirmed, "Already confirmed");
            claim.reporterConfirmed = true;

        } else if (msg.sender == claim.claimant) {
            require(!claim.claimantConfirmed, "Already confirmed");
            claim.claimantConfirmed = true;

        } else {
            revert("Not a party to this claim");
        }

        emit HandoverConfirmed(claimId, msg.sender);

        if (claim.reporterConfirmed && claim.claimantConfirmed) {
            claim.status = ClaimStatus.Completed;
            item.status = ItemStatus.Returned;

            // Mint once, only after both confirmations; Completed prevents replay.
            _mint(item.reporter, RETURN_REWARD);
            emit ReturnRewardIssued(item.id, item.reporter, RETURN_REWARD);
            emit ItemReturned(item.id, claimId);
        }
    }

    // ==========================================
    // 7. CLOSE AN ITEM
    // ==========================================

    function closeItem(
        uint256 itemId
    ) external onlyRegistered itemExists(itemId) {

        Item storage item = items[itemId];

        require(item.reporter == msg.sender, "Only reporter can close");
        require(
            item.status == ItemStatus.Open ||
            item.status == ItemStatus.ClaimPending,
            "Cannot close this item"
        );

        uint256[] storage ids = itemClaimIds[itemId];

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 claimId = ids[i];

            if (claims[claimId].status == ClaimStatus.Pending) {
                claims[claimId].status = ClaimStatus.Cancelled;
                emit ClaimCancelled(claimId);
            }
        }

        pendingClaimCount[itemId] = 0;
        item.status = ItemStatus.Closed;

        emit ItemClosed(itemId);
    }

    // ==========================================
    // 8. READ FUNCTIONS
    // ==========================================

    function getItemDetails(
        uint256 itemId
    ) external view itemExists(itemId) returns (Item memory) {
        return items[itemId];
    }

    function getClaimDetails(
        uint256 claimId
    ) external view claimExists(claimId) returns (Claim memory) {
        return claims[claimId];
    }

    function getItems() external view returns (Item[] memory result) {
        result = new Item[](allItemIds.length);

        for (uint256 i = 0; i < allItemIds.length; i++) {
            result[i] = items[allItemIds[i]];
        }
    }

    function getClaimsForItem(
        uint256 itemId
    ) external view itemExists(itemId) returns (Claim[] memory result) {
        uint256[] storage ids = itemClaimIds[itemId];

        result = new Claim[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = claims[ids[i]];
        }
    }

    function getItemCount() external view returns (uint256) {
        return allItemIds.length;
    }

    function getPendingClaimCount(
        uint256 itemId
    ) external view itemExists(itemId) returns (uint256) {
        return pendingClaimCount[itemId];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ConsentRegistry.sol";

/**
 * @title TrustPolicyRouter
 * @notice Rule-based anchoring constraints for P3 Protocol
 * @dev Manages trust policies and validates anchoring operations
 */
contract TrustPolicyRouter is AccessControl {
    bytes32 public constant POLICY_ADMIN_ROLE = keccak256("POLICY_ADMIN_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    struct Policy {
        bytes32 policyId;
        string name;
        string description;
        bool active;
        uint256 createdAt;
        uint256 updatedAt;
        mapping(bytes32 => bool) requiredConsents;
        bytes32[] requiredConsentsList;
    }

    struct ValidationRule {
        bytes32 ruleId;
        string name;
        bool requiresConsent;
        bytes32[] requiredPurposes;
        uint256 minTrustScore;
        bool active;
    }

    ConsentRegistry public consentRegistry;
    
    mapping(bytes32 => Policy) public policies;
    mapping(bytes32 => ValidationRule) public validationRules;
    mapping(address => uint256) public trustScores;
    
    bytes32[] public policyIds;
    bytes32[] public ruleIds;

    event PolicyCreated(bytes32 indexed policyId, string name);
    event PolicyUpdated(bytes32 indexed policyId);
    event PolicyActivated(bytes32 indexed policyId);
    event PolicyDeactivated(bytes32 indexed policyId);
    event ValidationRuleCreated(bytes32 indexed ruleId, string name);
    event ValidationRuleUpdated(bytes32 indexed ruleId);
    event TrustScoreUpdated(address indexed user, uint256 newScore);
    event ValidationPerformed(
        address indexed user,
        bytes32 indexed ruleId,
        bool passed
    );

    constructor(address _consentRegistry) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(POLICY_ADMIN_ROLE, msg.sender);
        _grantRole(VALIDATOR_ROLE, msg.sender);
        
        consentRegistry = ConsentRegistry(_consentRegistry);
    }

    /**
     * @notice Create a new policy
     * @param name Policy name
     * @param description Policy description
     * @param requiredConsents List of required consent purposes
     */
    function createPolicy(
        string calldata name,
        string calldata description,
        bytes32[] calldata requiredConsents
    ) external onlyRole(POLICY_ADMIN_ROLE) returns (bytes32) {
        bytes32 policyId = keccak256(
            abi.encodePacked(name, block.timestamp)
        );

        Policy storage policy = policies[policyId];
        policy.policyId = policyId;
        policy.name = name;
        policy.description = description;
        policy.active = true;
        policy.createdAt = block.timestamp;
        policy.updatedAt = block.timestamp;

        for (uint256 i = 0; i < requiredConsents.length; i++) {
            policy.requiredConsents[requiredConsents[i]] = true;
            policy.requiredConsentsList.push(requiredConsents[i]);
        }

        policyIds.push(policyId);

        emit PolicyCreated(policyId, name);

        return policyId;
    }

    /**
     * @notice Create a validation rule
     * @param name Rule name
     * @param requiresConsent Whether consent is required
     * @param requiredPurposes Required consent purposes
     * @param minTrustScore Minimum trust score
     */
    function createValidationRule(
        string calldata name,
        bool requiresConsent,
        bytes32[] calldata requiredPurposes,
        uint256 minTrustScore
    ) external onlyRole(POLICY_ADMIN_ROLE) returns (bytes32) {
        bytes32 ruleId = keccak256(
            abi.encodePacked(name, block.timestamp)
        );

        validationRules[ruleId] = ValidationRule({
            ruleId: ruleId,
            name: name,
            requiresConsent: requiresConsent,
            requiredPurposes: requiredPurposes,
            minTrustScore: minTrustScore,
            active: true
        });

        ruleIds.push(ruleId);

        emit ValidationRuleCreated(ruleId, name);

        return ruleId;
    }

    /**
     * @notice Validate user against a rule
     * @param user User address
     * @param ruleId Validation rule ID
     */
    function validateUser(
        address user,
        bytes32 ruleId
    ) external view returns (bool) {
        ValidationRule memory rule = validationRules[ruleId];
        require(rule.active, "Rule is not active");

        // Check trust score
        if (trustScores[user] < rule.minTrustScore) {
            return false;
        }

        // Check consents if required
        if (rule.requiresConsent) {
            for (uint256 i = 0; i < rule.requiredPurposes.length; i++) {
                if (!consentRegistry.hasValidConsent(user, rule.requiredPurposes[i])) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * @notice Update trust score for a user
     * @param user User address
     * @param score New trust score
     */
    function updateTrustScore(
        address user,
        uint256 score
    ) external onlyRole(VALIDATOR_ROLE) {
        require(score <= 100, "Score must be <= 100");
        trustScores[user] = score;
        emit TrustScoreUpdated(user, score);
    }

    /**
     * @notice Activate a policy
     * @param policyId Policy ID
     */
    function activatePolicy(bytes32 policyId) external onlyRole(POLICY_ADMIN_ROLE) {
        Policy storage policy = policies[policyId];
        require(policy.policyId == policyId, "Policy does not exist");
        policy.active = true;
        policy.updatedAt = block.timestamp;
        emit PolicyActivated(policyId);
    }

    /**
     * @notice Deactivate a policy
     * @param policyId Policy ID
     */
    function deactivatePolicy(bytes32 policyId) external onlyRole(POLICY_ADMIN_ROLE) {
        Policy storage policy = policies[policyId];
        require(policy.policyId == policyId, "Policy does not exist");
        policy.active = false;
        policy.updatedAt = block.timestamp;
        emit PolicyDeactivated(policyId);
    }

    /**
     * @notice Get required consents for a policy
     * @param policyId Policy ID
     */
    function getPolicyRequiredConsents(
        bytes32 policyId
    ) external view returns (bytes32[] memory) {
        return policies[policyId].requiredConsentsList;
    }

    /**
     * @notice Get all policy IDs
     */
    function getAllPolicyIds() external view returns (bytes32[] memory) {
        return policyIds;
    }

    /**
     * @notice Get all rule IDs
     */
    function getAllRuleIds() external view returns (bytes32[] memory) {
        return ruleIds;
    }
}

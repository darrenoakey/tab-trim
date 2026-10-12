Feature: Settings page
  As someone who keeps too many tabs open
  I want to choose my own limits
  So that Tab Trim closes tabs at the point that suits me

  Scenario: The settings page shows the default limits
    Given the browser is running with Tab Trim installed
    When I open the Tab Trim settings page
    Then the settings page is visible
    And the maximum tabs field shows "20"
    And the maximum copies field shows "2"

  Scenario: Saving a new tab limit
    Given the settings page is visible
    When I set the maximum tabs to "35"
    And I press "Save"
    Then I see the status "Saved."
    And after reopening the settings page the maximum tabs field shows "35"

  Scenario: Saving a new duplicate limit
    Given the settings page is visible
    When I set the maximum copies to "3"
    And I press "Save"
    Then I see the status "Saved."
    And after reopening the settings page the maximum copies field shows "3"

  Scenario: Rejecting a limit that is not a whole number
    Given the settings page is visible
    When I set the maximum tabs to "2.5"
    And I press "Save"
    Then I see the status "Maximum open tabs must be a whole number from 1 to 1000."
    And after reopening the settings page the maximum tabs field shows "20"

  Scenario: Rejecting a limit of zero copies
    Given the settings page is visible
    When I set the maximum copies to "0"
    And I press "Save"
    Then I see the status "Maximum copies of the same URL must be a whole number from 1 to 100."

  Scenario: Restoring the default limits
    Given the settings page is visible
    When I set the maximum tabs to "7"
    And I set the maximum copies to "5"
    And I press "Save"
    And I press "Restore defaults"
    Then I see the status "Defaults restored."
    And after reopening the settings page the maximum tabs field shows "20"
    And after reopening the settings page the maximum copies field shows "2"

  Scenario: The settings page counts open tabs across windows
    Given the settings page is visible
    When I open "/docs" in a new window
    And I reopen the settings page
    Then the settings page says "2 tabs open across 2 windows (limit 20)."

Feature: At most two copies of the same URL
  As someone who clicks the same link many times a day
  I want old copies of a page to close when I open it again
  So that I never pile up dozens of identical tabs

  Scenario: A third copy closes the oldest copy
    Given the browser is running with Tab Trim installed
    And I am looking at "/home"
    When I open "/git/status" from the link on "/home"
    And I open "/git/status" from the link on "/home"
    Then there are 2 copies of "/git/status" open
    When I open "/git/status" from the link on "/home"
    Then there are 2 copies of "/git/status" open
    And the oldest copy of "/git/status" is gone

  Scenario: Clicking the same link thirty times leaves two copies
    Given the browser is running with Tab Trim installed
    And I am looking at "/home"
    When I open "/git/status" from the link on "/home" 30 times
    Then there are 2 copies of "/git/status" open
    And there are 3 tabs open

  Scenario: A copy that is the only tab in its window closes its window
    Given the browser is running with Tab Trim installed
    And I am looking at "/home"
    When I open "/git/status" in a new window
    And I switch to the "/home" tab
    And I open "/git/status" from the link on "/home"
    Then there are 2 windows open
    When I open "/git/status" from the link on "/home"
    Then there is 1 window open
    And there are 2 copies of "/git/status" open

  Scenario: Navigating an existing tab to a URL also counts
    Given the browser is running with Tab Trim installed
    And I am looking at "/home"
    When I open "/git/status" from the link on "/home"
    And I open "/git/status" from the link on "/home"
    And I open "/docs" from the link on "/home"
    And I navigate the "/docs" tab to "/git/status"
    Then there are 2 copies of "/git/status" open

  Scenario: The copy limit can be changed
    Given the browser is running with Tab Trim installed
    And the maximum copies is set to 1 on the settings page
    And I am looking at "/home"
    When I open "/git/status" from the link on "/home"
    And I open "/git/status" from the link on "/home"
    Then there is 1 copy of "/git/status" open

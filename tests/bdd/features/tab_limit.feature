Feature: Maximum open tabs across all windows
  As someone who keeps too many tabs open
  I want the tab I used least recently to close when I go over my limit
  So that the total number of tabs across every window stays under control

  Scenario: Opening one tab too many closes the least recently used tab
    Given the browser is running with Tab Trim installed
    And the maximum tabs is set to 3 on the settings page
    And I am looking at "/home"
    When I open "/docs" from the link on "/home"
    And I open "/mail" from the link on "/home"
    Then the open pages are "/docs, /home, /mail"
    When I open "/news" from the link on "/home"
    Then the open pages are "/home, /mail, /news"

  Scenario: Switching back to a tab protects it
    Given the browser is running with Tab Trim installed
    And the maximum tabs is set to 3 on the settings page
    And I am looking at "/home"
    When I open "/docs" from the link on "/home"
    And I open "/mail" from the link on "/home"
    And I switch to the "/docs" tab
    And I open "/news" from the link on "/docs"
    Then the open pages are "/docs, /mail, /news"

  Scenario: The oldest tab is found in any window
    Given the browser is running with Tab Trim installed
    And the maximum tabs is set to 3 on the settings page
    And I am looking at "/home"
    When I open "/docs" in a new window
    And I open "/mail" from the link on "/docs"
    And I open "/news" from the link on "/docs"
    Then the open pages are "/docs, /mail, /news"
    And there is 1 window open

  Scenario: The last tab of a window takes its window with it
    Given the browser is running with Tab Trim installed
    And the maximum tabs is set to 3 on the settings page
    And I am looking at "/home"
    When I open "/wiki" in a new window
    And I switch to the "/home" tab
    And I open "/docs" from the link on "/home"
    Then there are 2 windows open
    When I switch to the "/home" tab
    And I open "/mail" from the link on "/home"
    Then the open pages are "/docs, /home, /mail"
    And there is 1 window open

  Scenario: Up to the limit nothing is closed
    Given the browser is running with Tab Trim installed
    And I am looking at "/home"
    When I open 19 different pages from links on "/home"
    Then there are 20 tabs open
    When I open "/wiki" from the link on "/home"
    Then there are 20 tabs open
    And "/page/1" is not open

local TopLevelMenu = {}
TopLevelMenu.SubMenu = {}
local TitleText = "Menu";
local EmptyText = "No Menu Available";
local ExitOnCancel = false;
local GoBackText = "Go Back";
local SortAlphaBetically = false;

_ShowMenu = function(menuItem)
        local menu = {}
        if SortAlphaBetically then
                table.sort(menuItem, function(a, b) return type(a) == "table" and type(b) == "table" and a.Name < b.Name; end);
        end     
        for k, v in ipairs(menuItem) do
                if type(v) == "table" then
                        menu[k] = v.Name;
                else
                        if GoBackText ~= nil and GoBackText ~= "" then
                                menu[k] = GoBackText;
                        end
                end
        end
        local ret = Script.ShowPopupList(TitleText, EmptyText, menu);
        if ret.Canceled == true or (ret.Selected.Key == 1 and ret.Selected.Value == GoBackText) then
                if ret.Canceled == true then
                        if ExitOnCancel == true then
                                return nil, menuItem, ret.Canceled, nil;
                        end
                end
                if menuItem.Parent == nil or menuItem.Parent.Parent == nil then
                        return nil, menuItem, ret.Canceled, nil;
                else
                        menu = nil;
                        ret = nil;
                        return _ShowMenu(menuItem.Parent.Parent);
                end
        else
                ret = menuItem[ret.Selected.Key];
                if ret.SubMenu == nil then
                        return ret.Data, menuItem, false, ret;
                else
                        menu = nil;
                        return _ShowMenu(ret.SubMenu);
                end
        end
end

Menu = {
        ShowMenu = function(menuItem) 
                return _ShowMenu(menuItem);
        end,
        ShowMainMenu = function()
                return _ShowMenu(TopLevelMenu.SubMenu);
        end,
        ResetMenu = function()
                TopLevelMenu.SubMenu = {}
                TitleText = "Menu";
                EmptyText = "No Menu Available";
                ExitOnCancel = false;
                GoBackText = "Go Back";
        end,
        MakeMenuItem = function(displayName, data)
                return {
                        Name = displayName;
                        Data = data;
                }
        end,
        AddSubMenuItem = function(menuItem, subMenuItem)
                if menuItem.SubMenu == nil then
                        menuItem.SubMenu = {}
                        menuItem.SubMenu[1] = GoBackText;
                        menuItem.SubMenu.Parent = menuItem;
                end
                subMenuItem.Parent = menuItem.SubMenu;
                table.insert(menuItem.SubMenu, subMenuItem);
        end,
        AddMainMenuItem = function(menuItem)
                if TopLevelMenu.SubMenu == nil then
                        TopLevelMenu.SubMenu = {}
                        TopLevelMenu.SubMenu.Parent = TopLevelMenu;
                end
                menuItem.Parent = TopLevelMenu.SubMenu;
                table.insert(TopLevelMenu.SubMenu, menuItem);
        end,
        SetTitle = function(title)
                TitleText = title;
        end,
        SetEmptyText = function(emptyText)
                EmptyText = emptyText;
        end,
        SetExitOnCancel = function(exitOnCancel)
                ExitOnCancel = exitOnCancel == true;
        end,
        SetGoBackText = function(goBackText)
                GoBackText = goBackText;
        end,
        SetSortAlphaBetically = function(sortAlphaBetically)
                SortAlphaBetically = sortAlphaBetically == true;
        end,
        IsMainMenu = function(menu)
                return menu == TopLevelMenu.SubMenu;
        end
}

return Menu;
